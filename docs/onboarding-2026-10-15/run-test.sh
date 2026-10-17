#!/usr/bin/env bash
# Disposable local Postgres (port 55435). Never touches production. Prelude reuses the support harness fixture.
set -u
D=/tmp/onbpg; S=/tmp/onbsock; rm -rf $D $S /tmp/onbrun; mkdir -p $D $S /tmp/onbrun/docs; U=${PG_RUN_USER:-lovable}; chown $U $D $S /tmp/onbrun
R="setpriv --reuid=$U --regid=$(id -gn $U) --clear-groups"
$R initdb -U postgres -D $D >/dev/null && $R pg_ctl -D $D -o "-p 55435 -k $S" -l $S/log start >/dev/null && sleep 2
cp -r docs/support-ticketing-2026-10-15 docs/onboarding-2026-10-15 /tmp/onbrun/docs/
sed -n '1,57p' docs/support-ticketing-2026-10-15/test.sql > /tmp/onbrun/prelude.sql
sed 's/^COMMIT;$/SELECT 1\/0; -- injected failure\nCOMMIT;/' docs/onboarding-2026-10-15/proposal.sql > /tmp/onbrun/proposal_fail.sql
cd /tmp/onbrun
psql -h $S -p 55435 -U postgres -q -X -f docs/onboarding-2026-10-15/test.sql -P pager=off -A -t 2>&1 | grep -vE "^(SET|$)" | tail -120
# Concurrency: one free seat left in OW's pool (O1+O3); two simultaneous server-side adds into different pooled companies.
P="psql -h $S -p 55435 -U postgres -q -X -At"
O1=00000000-0000-0000-0000-0000000000a1; O3=00000000-0000-0000-0000-0000000000a3
$P -c "CREATE OR REPLACE FUNCTION public._seat_caps_enabled() RETURNS boolean LANGUAGE sql STABLE AS \$\$ SELECT true \$\$;
 DELETE FROM subscribers; INSERT INTO platform_plans(key,member_limit) SELECT 'race', used+pending+1 FROM _seat_pool('$O1');
 INSERT INTO subscribers(user_id,email,subscribed,plan_key) VALUES ('88888888-0000-4000-8000-000000000012','ow@o1.test',true,'race');" >/dev/null
( $P -c "BEGIN; INSERT INTO organization_members(organization_id,user_id,role) VALUES ('$O1','f1111111-0000-4000-8000-000000000018','member'); SELECT pg_sleep(2); COMMIT;" > r1 2>&1 ) & sleep 0.5
$P -c "INSERT INTO organization_members(organization_id,user_id,role) VALUES ('$O3','f2222222-0000-4000-8000-000000000019','member');" > r2 2>&1; wait
N=$($P -c "SELECT count(*) FROM organization_members WHERE is_active AND user_id IN ('f1111111-0000-4000-8000-000000000018','f2222222-0000-4000-8000-000000000019')")
[ "$N" = 1 ] && grep -q "no free seats" r2 && echo "PASS|Simultaneous adds in one pool with one free seat: exactly 1 succeeds, the other waits and is refused" || echo "FAIL|concurrent adds active=$N r2=$(cat r2)"
cd /; $R pg_ctl -D $D stop >/dev/null; rm -rf $D $S /tmp/onbrun
