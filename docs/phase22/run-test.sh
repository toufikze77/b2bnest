#!/usr/bin/env bash
# Disposable local Postgres 16 (port 55445). Never touches production. Usage, from the repo root:
#   PG_RUN_USER=postgres bash docs/phase22/run-test.sh
# 1. Every earlier suite UNCHANGED: docs/phase20/run-test.sh (which runs Phases 12, 12b, 12c, 13, 15 and 20).
# 2. H: docs/phase22/test.sql on a fresh database (live functions verbatim → proposal → rules → rollback).
# 3. Guards: re-apply after rollback; a second apply is refused; a changed live function is refused, nothing applied.
set -u
[ "${SKIP_EARLIER:-0}" = 1 ] || bash docs/phase20/run-test.sh
D=/tmp/p22pg; S=/tmp/p22sock; U=${PG_RUN_USER:-postgres}; PORT=55445
R="setpriv --reuid=$U --regid=$(id -gn $U) --clear-groups"
BIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
P="psql -h $S -p $PORT -U postgres -q -X -At -v ON_ERROR_STOP=1"
W=/tmp/p22run; ROOT=$(pwd)
$R $BIN/pg_ctl -D $D stop >/dev/null 2>&1; rm -rf $D $S $W; mkdir -p $D $S $W; chown $U $D $S
$R $BIN/initdb -U postgres -D $D >/dev/null 2>&1 && $R $BIN/pg_ctl -D $D -o "-p $PORT -k $S" -l $S/log start >/dev/null && sleep 2
cp $ROOT/docs/phase22/*.sql $W/
echo "== H: docs/phase22/test.sql"
(cd $W && $P -f test.sql 2>&1 | grep -v NOTICE | grep -E "PASS\||FAIL\||TOTAL\||ERROR")
cd $W
$P -f proposal.sql >/dev/null 2>&1 && echo "PASS|proposal.sql applies again cleanly after rollback.sql" || echo "FAIL|re-apply after rollback"
OUT=$($P -f proposal.sql 2>&1); echo "$OUT" | grep -q "has changed since this was prepared\|already exists (applied twice?)" \
  && echo "PASS|Applying proposal.sql twice is refused by its guard" || echo "FAIL|second apply: $OUT"
$P -f rollback.sql >/dev/null
$P -c "CREATE OR REPLACE FUNCTION public.admin_overview_stats() RETURNS jsonb LANGUAGE sql AS \$\$ SELECT '{}'::jsonb \$\$;" >/dev/null
OUT=$($P -f proposal.sql 2>&1); echo "$OUT" | grep -q "admin_overview_stats has changed since this was prepared" \
  && echo "PASS|A changed live admin_overview_stats is refused" || echo "FAIL|hash guard: $OUT"
$P -At -c "SELECT CASE WHEN to_regclass('public.plan_prices') IS NULL THEN 'PASS|After the refused apply, nothing was created' ELSE 'FAIL|partial apply' END"
cd /; $R $BIN/pg_ctl -D $D stop >/dev/null; rm -rf $D $S $W
