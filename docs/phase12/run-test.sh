#!/usr/bin/env bash
# Disposable local Postgres 16 (port 55437). Never touches production.
# Baseline: support + onboarding harness fixtures (docs/support-ticketing-2026-10-15, docs/onboarding-2026-10-15),
# then the LIVE shapes read on 2026-10-27 (fixture-live.sql, loaded by test.sql). Usage, from the repo root:
#   PG_RUN_USER=postgres bash docs/phase12/run-test.sh
set -u
D=/tmp/p12pg; S=/tmp/p12sock; W=/tmp/p12run; U=${PG_RUN_USER:-postgres}; PORT=55437
rm -rf $D $S $W; mkdir -p $D $S $W/docs; chown $U $D $S
R="setpriv --reuid=$U --regid=$(id -gn $U) --clear-groups"
BIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
$R $BIN/initdb -U postgres -D $D >/dev/null && $R $BIN/pg_ctl -D $D -o "-p $PORT -k $S" -l $S/log start >/dev/null && sleep 2
cp -r docs/support-ticketing-2026-10-15 docs/onboarding-2026-10-15 $W/docs/
cp docs/phase12/*.sql $W/; chmod -R a+rX $W
mkdir -p /tmp/onbrun && sed -n '1,57p' docs/support-ticketing-2026-10-15/test.sql > /tmp/onbrun/prelude.sql
sed -n '1,43p' docs/onboarding-2026-10-15/test.sql > $W/fixture.sql
# precheck.sql's final SELECT, captured into a table so test.sql can compare it with the function
sed 's/^WITH roles AS/CREATE TABLE pc AS WITH roles AS/' docs/phase12/precheck.sql > $W/precheck-as-table.sql
grep -q "CREATE TABLE pc" $W/precheck-as-table.sql || echo "FAIL|could not wrap precheck.sql"
P="psql -h $S -p $PORT -U postgres -q -X -At -v ON_ERROR_STOP=1"
cd $W
$P -f fixture.sql >/dev/null 2>$W/fixture.err || { echo "FAIL|fixture"; cat $W/fixture.err; }
PGOPTIONS="-c p12.dir=$W" $P -f test.sql 2>&1 | grep -E "PASS\||FAIL\||TOTAL\||ERROR" | head -150
# The guard: applying proposal.sql on top of an already applied database is refused and changes nothing.
$P -f proposal.sql >/dev/null 2>&1 && echo "PASS|proposal.sql applies again cleanly after rollback.sql (the rollback is complete)" || echo "FAIL|re-apply after rollback"
OUT=$($P -f proposal.sql 2>&1); echo "$OUT" | grep -q "already exists (applied twice?)" \
  && echo "PASS|Applying proposal.sql twice is refused by its guard" || echo "FAIL|second apply: $OUT"
cd /; $R $BIN/pg_ctl -D $D stop >/dev/null; rm -rf $D $S $W /tmp/onbrun
