#!/usr/bin/env bash
# Disposable local Postgres (port 55434): runs test.sql, then a concurrent double-submit check, then deletes it.
set -u
D=/tmp/suppg; S=/tmp/supsock; rm -rf $D $S /tmp/suprun; mkdir -p $D $S /tmp/suprun/docs; chown lovable $D $S
R="setpriv --reuid=1000 --regid=1000 --clear-groups"
$R initdb -U postgres -D $D >/dev/null && $R pg_ctl -D $D -o "-p 55434 -k $S" -l $S/log start >/dev/null && sleep 2
cp -r docs/support-ticketing-2026-10-15 /tmp/suprun/docs/
sed 's/^COMMIT;$/SELECT 1\/0; -- injected failure\nCOMMIT;/' docs/support-ticketing-2026-10-15/proposal.sql > /tmp/suprun/proposal_fail.sql
cd /tmp/suprun
psql -h $S -p 55434 -U postgres -q -X -f docs/support-ticketing-2026-10-15/test.sql -P pager=off -A -t 2>&1 | grep -vE "^(SET|$)" | tail -80
# Concurrency: two simultaneous submits of the same ticket (same request id) -> one ticket.
P="psql -h $S -p 55434 -U postgres -q -X -At"
$P -c "\i docs/support-ticketing-2026-10-15/proposal.sql" >/dev/null 2>&1
$P -c "INSERT INTO support_settings(organization_id,support_name,portal_enabled) VALUES ('00000000-0000-0000-0000-0000000000a1','S',true);
 INSERT INTO support_customers(organization_id,email,invited_by,user_id) VALUES ('00000000-0000-0000-0000-0000000000a1','k@client.test','11111111-0000-4000-8000-00000000000d','44444444-0000-4000-8000-00000000000e');" >/dev/null
CALL="SET ROLE authenticated; SELECT set_config('request.jwt.claims','{\"sub\":\"44444444-0000-4000-8000-00000000000e\"}',false);"
SQL="SELECT support_create_ticket('00000000-0000-0000-0000-0000000000a1','Race','r',NULL,'low','e0000000-0000-0000-0000-0000000000ff')"
( $P -c "BEGIN; $CALL $SQL; SELECT pg_sleep(2); COMMIT;" > s1 ) & sleep 0.5
$P -c "$CALL $SQL;" > s2; wait
N=$($P -c "SELECT count(*) FROM support_tickets WHERE subject='Race'")
[ "$N" = 1 ] && [ "$(grep -E '^[0-9a-f-]{36}$' s1)" = "$(grep -E '^[0-9a-f-]{36}$' s2)" ] && echo "PASS|Simultaneous double submit: 1 ticket, same id returned" || echo "FAIL|concurrent tickets=$N"
cd /; $R pg_ctl -D $D stop >/dev/null; rm -rf $D $S /tmp/suprun
