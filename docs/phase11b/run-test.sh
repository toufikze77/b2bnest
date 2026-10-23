#!/usr/bin/env bash
# Disposable local Postgres 16 (port 55436). Never touches production.
# Baseline: support + onboarding harness fixtures (docs/support-ticketing-2026-10-15, docs/onboarding-2026-10-15),
# then the LIVE definitions read on 2026-10-23 (live-functions-2026-10-23.sql). Usage, from the repo root:
#   PG_RUN_USER=postgres bash docs/phase11b/run-test.sh
set -u
D=/tmp/p11bpg; S=/tmp/p11bsock; W=/tmp/p11brun; U=${PG_RUN_USER:-postgres}; PORT=55436
rm -rf $D $S $W; mkdir -p $D $S $W/docs; chown $U $D $S
R="setpriv --reuid=$U --regid=$(id -gn $U) --clear-groups"
BIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
$R $BIN/initdb -U postgres -D $D >/dev/null && $R $BIN/pg_ctl -D $D -o "-p $PORT -k $S" -l $S/log start >/dev/null && sleep 2
cp -r docs/support-ticketing-2026-10-15 docs/onboarding-2026-10-15 $W/docs/
cp docs/phase11b/*.sql $W/
sed -n '1,57p' docs/support-ticketing-2026-10-15/test.sql > /tmp/onbrun_prelude.sql 2>/dev/null
mkdir -p /tmp/onbrun && cp /tmp/onbrun_prelude.sql /tmp/onbrun/prelude.sql
# Onboarding fixture + the onboarding package as applied in production (lines up to its \i proposal.sql)
sed -n '1,43p' docs/onboarding-2026-10-15/test.sql > $W/fixture.sql
P="psql -h $S -p $PORT -U postgres -q -X -At -v ON_ERROR_STOP=1"
cd $W
# The rollback must carry the live definitions verbatim.
python3 - <<'PY' || { echo "FAIL|rollback.sql does not contain live-functions-2026-10-23.sql verbatim"; }
live = open('live-functions-2026-10-23.sql').read().split('\n', 2)[2]
assert live in open('rollback.sql').read()
print('PASS|rollback.sql contains the live definitions verbatim')
PY
$P -f fixture.sql >/dev/null 2>$W/fixture.err || { echo "FAIL|fixture"; cat $W/fixture.err; }
$P -f test.sql 2>&1 | grep -E "^(PASS|FAIL|TOTAL)|ERROR" | head -120

# Concurrency (caps on, one free seat): two simultaneous adds into the same pool from two sessions → exactly one wins.
$P -c "\i enable-caps.sql" >/dev/null
$P -c "SELECT company('20000000-0000-4000-8000-000000000001','race@t.test'); SELECT company('20000000-0000-4000-8000-000000000002','race@t.test');
       SELECT sub('race@t.test','professional','price_bus35');
       INSERT INTO platform_plan_prices VALUES ('price_bus35','professional_legacy') ON CONFLICT DO NOTHING;
       SELECT add('20000000-0000-4000-8000-000000000001', 'r'||g||'@t.test') FROM generate_series(1,3) g;
       SELECT mk('rx@t.test'), mk('ry@t.test');" >/dev/null
( $P -c "BEGIN; INSERT INTO organization_members(organization_id,user_id,role) SELECT '20000000-0000-4000-8000-000000000001', uid('rx@t.test'), 'member'; SELECT pg_sleep(2); COMMIT;" > r1 2>&1 ) & sleep 0.5
$P -c "INSERT INTO organization_members(organization_id,user_id,role) SELECT '20000000-0000-4000-8000-000000000002', uid('ry@t.test'), 'member';" > r2 2>&1; wait
N=$($P -c "SELECT count(*) FROM organization_members WHERE is_active AND user_id IN (uid('rx@t.test'), uid('ry@t.test'))")
[ "$N" = 1 ] && grep -q "no free seats" r2 && echo "PASS|Two simultaneous adds with one seat left: exactly 1 succeeds, the other waits and is refused" || echo "FAIL|concurrent adds active=$N r2=$(cat r2)"
# Same for admins: a new-price Business pool (50 users, 5 admins) with owner + 3 admins → one admin seat left, plenty of user seats.
$P -c "SELECT company('20000000-0000-4000-8000-000000000003','race2@t.test'); SELECT company('20000000-0000-4000-8000-000000000004','race2@t.test');
       SELECT sub('race2@t.test','professional','price_bus59');
       SELECT add('20000000-0000-4000-8000-000000000003', 'q'||g||'@t.test', 'admin') FROM generate_series(1,3) g;
       SELECT mk('qx@t.test'), mk('qy@t.test');" >/dev/null
( $P -c "BEGIN; INSERT INTO organization_members(organization_id,user_id,role) SELECT '20000000-0000-4000-8000-000000000003', uid('qx@t.test'), 'admin'; SELECT pg_sleep(2); COMMIT;" > r3 2>&1 ) & sleep 0.5
$P -c "INSERT INTO organization_members(organization_id,user_id,role) SELECT '20000000-0000-4000-8000-000000000004', uid('qy@t.test'), 'admin';" > r4 2>&1; wait
N=$($P -c "SELECT count(*) FROM organization_members WHERE is_active AND role='admin' AND user_id IN (uid('qx@t.test'), uid('qy@t.test'))")
[ "$N" = 1 ] && grep -q "no free admin seats" r4 && echo "PASS|Two simultaneous admin adds with one admin seat left: exactly 1 succeeds" || echo "FAIL|concurrent admin adds admins=$N r4=$(cat r4)"

cd /; $R $BIN/pg_ctl -D $D stop >/dev/null; rm -rf $D $S $W /tmp/onbrun /tmp/onbrun_prelude.sql
