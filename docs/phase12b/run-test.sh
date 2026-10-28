#!/usr/bin/env bash
# Disposable local Postgres 16 (port 55438). Never touches production. Usage, from the repo root:
#   PG_RUN_USER=postgres bash docs/phase12b/run-test.sh
# Run A: docs/phase12/test.sql unchanged, as Phase 12 is live today (baseline).
# Run B: docs/phase12/test.sql unchanged, with Phase 12b applied on top (its "proposal" = Phase 12 + 12b, its
#        "rollback" = 12b rollback + Phase 12 rollback). Every Phase 12 rule must still pass.
# Run C: docs/phase12b/test.sql, then the guard (second apply refused) and re-apply after rollback.
set -u
D=/tmp/p12bpg; S=/tmp/p12bsock; U=${PG_RUN_USER:-postgres}; PORT=55438
R="setpriv --reuid=$U --regid=$(id -gn $U) --clear-groups"
BIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
P="psql -h $S -p $PORT -U postgres -q -X -At -v ON_ERROR_STOP=1"
ROOT=$(pwd)
fresh_db() { # $1 = work dir
  $R $BIN/pg_ctl -D $D stop >/dev/null 2>&1; rm -rf $D $S "$1"; mkdir -p $D $S "$1/docs"; chown $U $D $S
  $R $BIN/initdb -U postgres -D $D >/dev/null 2>&1 && $R $BIN/pg_ctl -D $D -o "-p $PORT -k $S" -l $S/log start >/dev/null && sleep 2
  cp -r $ROOT/docs/support-ticketing-2026-10-15 $ROOT/docs/onboarding-2026-10-15 "$1/docs/"
  mkdir -p /tmp/onbrun && sed -n '1,57p' $ROOT/docs/support-ticketing-2026-10-15/test.sql > /tmp/onbrun/prelude.sql
  sed -n '1,43p' $ROOT/docs/onboarding-2026-10-15/test.sql > "$1/fixture.sql"
  (cd "$1" && $P -f fixture.sql >/dev/null 2>fixture.err) || { echo "FAIL|fixture"; cat "$1/fixture.err"; }
}
p12_dir() { # $1 = work dir: the Phase 12 package as its run-test.sh lays it out
  cp $ROOT/docs/phase12/*.sql "$1/"
  sed 's/^WITH roles AS/CREATE TABLE pc AS WITH roles AS/' $ROOT/docs/phase12/precheck.sql > "$1/precheck-as-table.sql"
}

echo "== Run A: Phase 12 tests, unchanged (production today)"
W=/tmp/p12brunA; fresh_db $W; p12_dir $W
(cd $W && PGOPTIONS="-c p12.dir=$W" $P -f test.sql 2>&1 | grep -E "FAIL\||TOTAL\||ERROR")

echo "== Run B: Phase 12 tests, unchanged, with Phase 12b applied on top"
W=/tmp/p12brunB; fresh_db $W; p12_dir $W
# Phase 12 exactly as live (the live body has no comment line), then 12b
sed "/-- Companies where the caller is an active member and someone else is the billing owner/d" $ROOT/docs/phase12/proposal.sql > $W/proposal.sql
cat $ROOT/docs/phase12b/fixture-live.sql $ROOT/docs/phase12b/proposal.sql >> $W/proposal.sql # + the live admin_audit_logs shape
# (rollback.sql below drops 12b, then Phase 12; the fixture table stays, as in production)
cat $ROOT/docs/phase12b/rollback.sql $ROOT/docs/phase12/rollback.sql > $W/rollback.sql
(cd $W && PGOPTIONS="-c p12.dir=$W" $P -f test.sql 2>&1 | grep -E "FAIL\||TOTAL\||ERROR")

echo "== Run C: Phase 12b tests"
W=/tmp/p12brunC; fresh_db $W
cp $ROOT/docs/phase12/fixture-live.sql $W/p12-fixture-live.sql; sed "/-- Companies where the caller is an active member and someone else is the billing owner/d" $ROOT/docs/phase12/proposal.sql > $W/p12-proposal.sql
cp $ROOT/docs/phase12b/*.sql $W/
(cd $W && $P -f test.sql 2>&1 | grep -E "PASS\||FAIL\||TOTAL\||ERROR|NOTICE" | grep -v "already exists, skipping")
cd $W
$P -f proposal.sql >/dev/null 2>&1 && echo "PASS|proposal.sql applies again cleanly after rollback.sql" || echo "FAIL|re-apply after rollback"
OUT=$($P -f proposal.sql 2>&1); echo "$OUT" | grep -q "already exists (applied twice?)" \
  && echo "PASS|Applying proposal.sql twice is refused by its guard" || echo "FAIL|second apply: $OUT"
# Two super admins remove the last two master accounts at the same moment: exactly one succeeds.
$P -c "SELECT signup('sb@t.test'); INSERT INTO public.user_roles(user_id, role) VALUES (uid('sb@t.test'), 'super_admin');
       SELECT sw('sa@t.test', 'm1@t.test', true), sw('sa@t.test', 'm2@t.test', true);" >/dev/null
( $P -c "BEGIN; SET LOCAL request.jwt.claims = '{\"sub\":\"$($P -c "SELECT uid('sa@t.test')")\"}'; SET LOCAL ROLE authenticated;
         SELECT public.set_master_access('$($P -c "SELECT uid('m1@t.test')")', false); SELECT pg_sleep(2); COMMIT;" > r1 2>&1 ) & sleep 0.5
$P -c "BEGIN; SET LOCAL request.jwt.claims = '{\"sub\":\"$($P -c "SELECT uid('sb@t.test')")\"}'; SET LOCAL ROLE authenticated;
       SELECT public.set_master_access('$($P -c "SELECT uid('m2@t.test')")', false); COMMIT;" > r2 2>&1; wait
N=$($P -c "SELECT count(*) FROM public.master_access")
[ "$N" = 1 ] && grep -q "last master account" r2 && echo "PASS|Two super admins removing the last two masters at once: exactly one succeeds, one master remains" \
  || echo "FAIL|concurrent removal: masters=$N r1=$(cat r1) r2=$(cat r2)"
cd /; $R $BIN/pg_ctl -D $D stop >/dev/null; rm -rf $D $S /tmp/p12brunA /tmp/p12brunB /tmp/p12brunC /tmp/onbrun
