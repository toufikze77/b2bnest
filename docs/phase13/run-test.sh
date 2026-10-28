#!/usr/bin/env bash
# Disposable local Postgres 16 (port 55442). Never touches production. Usage, from the repo root:
#   PG_RUN_USER=postgres bash docs/phase13/run-test.sh
# "Production today" = Phase 12 (as live) + 12b + 12c. Each earlier suite runs UNCHANGED twice: before (production today)
# and after (with Phase 13 on top), its "proposal" / "rollback" being the composed packages (as docs/phase12c/run-test.sh).
#   A1/A2  docs/phase12/test.sql    B1/B2  docs/phase12b/test.sql    C1/C2  docs/phase12c/test.sql
#   D      docs/phase13/test.sql, then the guard (second apply refused) and re-apply after rollback
set -u
D=/tmp/p13pg; S=/tmp/p13sock; U=${PG_RUN_USER:-postgres}; PORT=55442
R="setpriv --reuid=$U --regid=$(id -gn $U) --clear-groups"
BIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
P="psql -h $S -p $PORT -U postgres -q -X -At -v ON_ERROR_STOP=1"
ROOT=$(pwd); WR=/tmp/p13run; DOC=$ROOT/docs
P12_LIVE() { sed "/-- Companies where the caller is an active member and someone else is the billing owner/d" $DOC/phase12/proposal.sql; }
fresh_db() {
  $R $BIN/pg_ctl -D $D stop >/dev/null 2>&1; rm -rf $D $S "$1"; mkdir -p $D $S "$1/docs"; chown $U $D $S
  $R $BIN/initdb -U postgres -D $D >/dev/null 2>&1 && $R $BIN/pg_ctl -D $D -o "-p $PORT -k $S" -l $S/log start >/dev/null && sleep 2
  cp -r $DOC/support-ticketing-2026-10-15 $DOC/onboarding-2026-10-15 "$1/docs/"
  mkdir -p /tmp/onbrun && sed -n '1,57p' $DOC/support-ticketing-2026-10-15/test.sql > /tmp/onbrun/prelude.sql
  sed -n '1,43p' $DOC/onboarding-2026-10-15/test.sql > "$1/fixture.sql"
  (cd "$1" && $P -f fixture.sql >/dev/null 2>fixture.err) || { echo "FAIL|fixture"; cat "$1/fixture.err"; }
}
quiet() { grep -v NOTICE | grep -E "FAIL\||TOTAL\||ERROR"; }
P13_UP() { cat $DOC/phase13/proposal.sql; }

run_p12() { # $1 label, $2 with13
  echo "== $1: docs/phase12/test.sql unchanged"
  W=$WR/$1; fresh_db $W; cp $DOC/phase12/*.sql $W/
  sed 's/^WITH roles AS/CREATE TABLE pc AS WITH roles AS/' $DOC/phase12/precheck.sql > $W/precheck-as-table.sql
  { P12_LIVE; cat $DOC/phase12b/fixture-live.sql $DOC/phase12b/proposal.sql $DOC/phase12c/fixture-live.sql $DOC/phase12c/proposal.sql; } > $W/proposal.sql
  cat $DOC/phase12c/rollback.sql $DOC/phase12b/rollback.sql $DOC/phase12/rollback.sql > $W/rollback.sql
  if [ "$2" = 1 ]; then P13_UP >> $W/proposal.sql; { cat $DOC/phase13/rollback.sql; cat $DOC/phase12c/rollback.sql $DOC/phase12b/rollback.sql $DOC/phase12/rollback.sql; } > $W/rollback.sql; fi
  (cd $W && PGOPTIONS="-c p12.dir=$W" $P -f test.sql 2>&1 | quiet)
}
run_p12b() {
  echo "== $1: docs/phase12b/test.sql unchanged"
  W=$WR/$1; fresh_db $W; cp $DOC/phase12b/*.sql $W/
  cp $DOC/phase12/fixture-live.sql $W/p12-fixture-live.sql; P12_LIVE > $W/p12-proposal.sql
  cat $DOC/phase12c/fixture-live.sql $DOC/phase12c/proposal.sql >> $W/proposal.sql
  cat $DOC/phase12c/rollback.sql $DOC/phase12b/rollback.sql > $W/rollback.sql
  if [ "$2" = 1 ]; then P13_UP >> $W/proposal.sql; { cat $DOC/phase13/rollback.sql $DOC/phase12c/rollback.sql $DOC/phase12b/rollback.sql; } > $W/rollback.sql; fi
  (cd $W && $P -f test.sql 2>&1 | quiet)
}
run_p12c() {
  echo "== $1: docs/phase12c/test.sql unchanged"
  W=$WR/$1; fresh_db $W; cp $DOC/phase12c/*.sql $W/
  cp $DOC/phase12/fixture-live.sql $W/p12-fixture-live.sql; P12_LIVE > $W/p12-proposal.sql
  cp $DOC/phase12b/fixture-live.sql $W/p12b-fixture-live.sql; cp $DOC/phase12b/proposal.sql $W/p12b-proposal.sql
  if [ "$2" = 1 ]; then P13_UP >> $W/proposal.sql; { cat $DOC/phase13/rollback.sql $DOC/phase12c/rollback.sql; } > $W/rollback.sql; fi
  (cd $W && $P -f test.sql 2>&1 | quiet)
}
run_p12 A1 0; run_p12 A2 1; run_p12b B1 0; run_p12b B2 1; run_p12c C1 0; run_p12c C2 1

echo "== D: docs/phase13/test.sql"
W=$WR/D; fresh_db $W; cp $DOC/phase13/*.sql $W/
cp $DOC/phase12/fixture-live.sql $W/p12-fixture-live.sql; P12_LIVE > $W/p12-proposal.sql
cp $DOC/phase12b/fixture-live.sql $W/p12b-fixture-live.sql; cp $DOC/phase12b/proposal.sql $W/p12b-proposal.sql
cp $DOC/phase12c/fixture-live.sql $W/p12c-fixture-live.sql; cp $DOC/phase12c/proposal.sql $W/p12c-proposal.sql
sed 's/^WITH due AS (/CREATE TABLE pc AS WITH due AS (/' $DOC/phase13/precheck.sql > $W/precheck-as-table.sql
grep -q "CREATE TABLE pc" $W/precheck-as-table.sql || echo "FAIL|could not wrap precheck.sql"
(cd $W && PGOPTIONS="-c p13.dir=$W" $P -f test.sql 2>&1 | grep -v NOTICE | grep -E "PASS\||FAIL\||TOTAL\||ERROR")
cd $W
$P -f proposal.sql >/dev/null 2>&1 && echo "PASS|proposal.sql applies again cleanly after rollback.sql" || echo "FAIL|re-apply after rollback"
OUT=$($P -f proposal.sql 2>&1); echo "$OUT" | grep -q "already exists (applied twice?)" \
  && echo "PASS|Applying proposal.sql twice is refused by its guard" || echo "FAIL|second apply: $OUT"
cd /; $R $BIN/pg_ctl -D $D stop >/dev/null; rm -rf $D $S $WR /tmp/onbrun
