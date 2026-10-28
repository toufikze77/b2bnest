#!/usr/bin/env bash
# Disposable local Postgres 16 (port 55441). Never touches production. Usage, from the repo root:
#   PG_RUN_USER=postgres bash docs/phase12c/run-test.sh
# "Production today" = Phase 12 (as live: its body without the one comment line) + 12b. Each earlier suite runs
# UNCHANGED twice: before (production today) and after (with 12c applied on top). Its "proposal" / "rollback" files are
# the composed packages, as docs/phase12b/run-test.sh does.
#   A1/A2  docs/phase12/test.sql   before / after
#   B1/B2  docs/phase12b/test.sql  before / after
#   C      docs/phase12c/test.sql, then the guard (second apply refused) and re-apply after rollback
set -u
D=/tmp/p12cpg; S=/tmp/p12csock; U=${PG_RUN_USER:-postgres}; PORT=55441
R="setpriv --reuid=$U --regid=$(id -gn $U) --clear-groups"
BIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
P="psql -h $S -p $PORT -U postgres -q -X -At -v ON_ERROR_STOP=1"
ROOT=$(pwd); WR=/tmp/p12crun
P12_LIVE() { sed "/-- Companies where the caller is an active member and someone else is the billing owner/d" $ROOT/docs/phase12/proposal.sql; }
fresh_db() { # $1 = work dir
  $R $BIN/pg_ctl -D $D stop >/dev/null 2>&1; rm -rf $D $S "$1"; mkdir -p $D $S "$1/docs"; chown $U $D $S
  $R $BIN/initdb -U postgres -D $D >/dev/null 2>&1 && $R $BIN/pg_ctl -D $D -o "-p $PORT -k $S" -l $S/log start >/dev/null && sleep 2
  cp -r $ROOT/docs/support-ticketing-2026-10-15 $ROOT/docs/onboarding-2026-10-15 "$1/docs/"
  mkdir -p /tmp/onbrun && sed -n '1,57p' $ROOT/docs/support-ticketing-2026-10-15/test.sql > /tmp/onbrun/prelude.sql
  sed -n '1,43p' $ROOT/docs/onboarding-2026-10-15/test.sql > "$1/fixture.sql"
  (cd "$1" && $P -f fixture.sql >/dev/null 2>fixture.err) || { echo "FAIL|fixture"; cat "$1/fixture.err"; }
}
quiet() { grep -E "FAIL\||TOTAL\||ERROR" ; }

run_p12() { # $1 = label, $2 = with12c (0/1)
  echo "== $1: docs/phase12/test.sql unchanged"
  W=$WR/$1; fresh_db $W; cp $ROOT/docs/phase12/*.sql $W/
  sed 's/^WITH roles AS/CREATE TABLE pc AS WITH roles AS/' $ROOT/docs/phase12/precheck.sql > $W/precheck-as-table.sql
  { P12_LIVE; cat $ROOT/docs/phase12b/fixture-live.sql $ROOT/docs/phase12b/proposal.sql; } > $W/proposal.sql
  cat $ROOT/docs/phase12b/rollback.sql $ROOT/docs/phase12/rollback.sql > $W/rollback.sql
  if [ "$2" = 1 ]; then
    cat $ROOT/docs/phase12c/fixture-live.sql $ROOT/docs/phase12c/proposal.sql >> $W/proposal.sql
    { cat $ROOT/docs/phase12c/rollback.sql; cat $ROOT/docs/phase12b/rollback.sql $ROOT/docs/phase12/rollback.sql; } > $W/rollback.sql
  fi
  (cd $W && PGOPTIONS="-c p12.dir=$W" $P -f test.sql 2>&1 | quiet)
}
run_p12b() { # $1 = label, $2 = with12c (0/1)
  echo "== $1: docs/phase12b/test.sql unchanged"
  W=$WR/$1; fresh_db $W; cp $ROOT/docs/phase12b/*.sql $W/
  cp $ROOT/docs/phase12/fixture-live.sql $W/p12-fixture-live.sql; P12_LIVE > $W/p12-proposal.sql
  if [ "$2" = 1 ]; then
    cat $ROOT/docs/phase12c/fixture-live.sql $ROOT/docs/phase12c/proposal.sql >> $W/proposal.sql
    cat $ROOT/docs/phase12c/rollback.sql $ROOT/docs/phase12b/rollback.sql > $W/rollback.sql
  fi
  (cd $W && $P -f test.sql 2>&1 | grep -v NOTICE | quiet)
}
run_p12 A1 0; run_p12 A2 1
run_p12b B1 0; run_p12b B2 1

echo "== C: docs/phase12c/test.sql"
W=$WR/C; fresh_db $W; cp $ROOT/docs/phase12c/*.sql $W/
cp $ROOT/docs/phase12/fixture-live.sql $W/p12-fixture-live.sql; P12_LIVE > $W/p12-proposal.sql
cp $ROOT/docs/phase12b/fixture-live.sql $W/p12b-fixture-live.sql; cp $ROOT/docs/phase12b/proposal.sql $W/p12b-proposal.sql
(cd $W && $P -f test.sql 2>&1 | grep -E "PASS\||FAIL\||TOTAL\||ERROR")
cd $W
$P -f proposal.sql >/dev/null 2>&1 && echo "PASS|proposal.sql applies again cleanly after rollback.sql" || echo "FAIL|re-apply after rollback"
OUT=$($P -f proposal.sql 2>&1); echo "$OUT" | grep -q "already exists (applied twice?)" \
  && echo "PASS|Applying proposal.sql twice is refused by its guard" || echo "FAIL|second apply: $OUT"
cd /; $R $BIN/pg_ctl -D $D stop >/dev/null; rm -rf $D $S $WR /tmp/onbrun
