#!/usr/bin/env bash
# Builds a disposable local Postgres (port 55433) as an unprivileged user, runs test.sql
# plus a two-session concurrency check for "Create task", then deletes it.
set -u
D=/tmp/mktpg; S=/tmp/mktsock; rm -rf $D $S; mkdir -p $D $S; chown lovable $D $S
R="setpriv --reuid=1000 --regid=1000 --clear-groups"
$R initdb -U postgres -D $D >/dev/null && $R pg_ctl -D $D -o "-p 55433 -k $S" -l $S/log start >/dev/null && sleep 2
mkdir -p /tmp/mktrun/docs && rm -rf /tmp/mktrun/docs/marketing-workspace-2026-10-10 && cp -r docs/marketing-workspace-2026-10-10 /tmp/mktrun/docs/
sed 's/^COMMIT;$/SELECT 1\/0; -- injected failure\nCOMMIT;/' docs/marketing-workspace-2026-10-10/proposal.sql > /tmp/mktrun/proposal_fail.sql
P="psql -h $S -p 55433 -U postgres -q -X -At"
(cd /tmp/mktrun && psql -h $S -p 55433 -U postgres -q -X -f docs/marketing-workspace-2026-10-10/test.sql)

# Concurrency: two simultaneous "Create task" calls for the same item (timeout + retry case).
cd /tmp/mktrun
$P -c "\i docs/marketing-workspace-2026-10-10/proposal.sql" >/dev/null
$P -c "INSERT INTO organization_members(organization_id,user_id) SELECT '00000000-0000-0000-0000-0000000000a1','aaaaaaaa-0000-4000-8000-000000000001' WHERE NOT EXISTS (SELECT 1 FROM organization_members WHERE user_id='aaaaaaaa-0000-4000-8000-000000000001');
 INSERT INTO marketing_content_items(id,user_id,title) VALUES ('ec000000-0000-0000-0000-0000000000cc','aaaaaaaa-0000-4000-8000-000000000001','Race');"
CALL="SET ROLE authenticated; SELECT set_config('request.jwt.claims','{\"sub\":\"aaaaaaaa-0000-4000-8000-000000000001\"}',false);"
( $P -c "BEGIN; $CALL SELECT marketing_create_followup_task('ec000000-0000-0000-0000-0000000000cc','00000000-0000-0000-0000-0000000000a1'); SELECT pg_sleep(2); COMMIT;" > /tmp/mktrun/s1 ) &
sleep 0.5
$P -c "$CALL SELECT marketing_create_followup_task('ec000000-0000-0000-0000-0000000000cc','00000000-0000-0000-0000-0000000000a1');" > /tmp/mktrun/s2
wait
N=$($P -c "SELECT count(*) FROM todos WHERE title='Content: Race'")
ID1=$(grep -E '^[0-9a-f-]{36}$' /tmp/mktrun/s1); ID2=$(grep -E '^[0-9a-f-]{36}$' /tmp/mktrun/s2)
[ "$N" = 1 ] && [ "$ID1" = "$ID2" ] && echo "PASS|Concurrent create-task calls: 1 task, both returned same id" || echo "FAIL|concurrent: tasks=$N ids=$ID1/$ID2"
cd /; $R pg_ctl -D $D stop >/dev/null; rm -rf $D $S /tmp/mktrun