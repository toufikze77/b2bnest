#!/usr/bin/env bash
# Disposable local Postgres 16 (port 55443). Never touches production. Usage, from the repo root:
#   PG_RUN_USER=postgres bash docs/phase15/run-test.sh
# 1. Every earlier suite UNCHANGED (docs/phase13/run-test.sh: Phases 12, 12b, 12c, 13). Phase 15 touches only
#    public.workflow_run_logs, which none of them use.
# 2. E: docs/phase15/test.sql on a fresh database (live table shape → proposal → rules → rollback), then re-apply after
#    rollback and the second-apply guard.
set -u
bash docs/phase13/run-test.sh
D=/tmp/p15pg; S=/tmp/p15sock; U=${PG_RUN_USER:-postgres}; PORT=55443
R="setpriv --reuid=$U --regid=$(id -gn $U) --clear-groups"
BIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
P="psql -h $S -p $PORT -U postgres -q -X -At -v ON_ERROR_STOP=1"
W=/tmp/p15run; ROOT=$(pwd)
$R $BIN/pg_ctl -D $D stop >/dev/null 2>&1; rm -rf $D $S $W; mkdir -p $D $S $W; chown $U $D $S
$R $BIN/initdb -U postgres -D $D >/dev/null 2>&1 && $R $BIN/pg_ctl -D $D -o "-p $PORT -k $S" -l $S/log start >/dev/null && sleep 2
cp $ROOT/docs/phase15/*.sql $W/
echo "== E: docs/phase15/test.sql"
(cd $W && $P -f test.sql 2>&1 | grep -v NOTICE | grep -E "PASS\||FAIL\||TOTAL\||ERROR")
cd $W
$P -f proposal.sql >/dev/null 2>&1 && echo "PASS|proposal.sql applies again cleanly after rollback.sql" || echo "FAIL|re-apply after rollback"
OUT=$($P -f proposal.sql 2>&1); echo "$OUT" | grep -q "already exists (applied twice?)" \
  && echo "PASS|Applying proposal.sql twice is refused by its guard" || echo "FAIL|second apply: $OUT"
cd /; $R $BIN/pg_ctl -D $D stop >/dev/null; rm -rf $D $S $W
