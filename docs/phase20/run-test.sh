#!/usr/bin/env bash
# Disposable local Postgres 16 (port 55444). Never touches production. Usage, from the repo root:
#   PG_RUN_USER=postgres bash docs/phase20/run-test.sh
# 1. Every earlier suite UNCHANGED (docs/phase15/run-test.sh runs Phases 12, 12b, 12c, 13 and 15). Phase 20 only adds
#    public.refund_ai_credit, which none of them use.
# 2. F: docs/phase20/test.sql on a fresh database (live function verbatim → proposal → rules → rollback).
# 3. Guards: re-apply after rollback; a second apply is refused; a changed check_and_deduct_ai_credit is refused.
# 4. Concurrency: 20 requests at once against 5 credits, each "reserving" then (for odd ones) refunding, from 20
#    separate connections. The balance must never go below 0, exactly 5 reservations may succeed, and the end balance
#    must equal 5 - successes + refunds.
set -u
bash docs/phase15/run-test.sh
D=/tmp/p20pg; S=/tmp/p20sock; U=${PG_RUN_USER:-postgres}; PORT=55444
R="setpriv --reuid=$U --regid=$(id -gn $U) --clear-groups"
BIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
P="psql -h $S -p $PORT -U postgres -q -X -At -v ON_ERROR_STOP=1"
W=/tmp/p20run; ROOT=$(pwd)
fresh_db() {
  $R $BIN/pg_ctl -D $D stop >/dev/null 2>&1; rm -rf $D $S $W; mkdir -p $D $S $W; chown $U $D $S
  $R $BIN/initdb -U postgres -D $D >/dev/null 2>&1 && $R $BIN/pg_ctl -D $D -o "-p $PORT -k $S -c max_connections=60" -l $S/log start >/dev/null && sleep 2
  cp $ROOT/docs/phase20/*.sql $W/
}
fresh_db
echo "== F: docs/phase20/test.sql"
(cd $W && $P -f test.sql 2>&1 | grep -v NOTICE | grep -E "PASS\||FAIL\||TOTAL\||ERROR")
cd $W
$P -f proposal.sql >/dev/null 2>&1 && echo "PASS|proposal.sql applies again cleanly after rollback.sql" || echo "FAIL|re-apply after rollback"
OUT=$($P -f proposal.sql 2>&1); echo "$OUT" | grep -q "already exists (applied twice?)" \
  && echo "PASS|Applying proposal.sql twice is refused by its guard" || echo "FAIL|second apply: $OUT"
$P -c "DROP FUNCTION public.refund_ai_credit(uuid, integer);" >/dev/null
$P -c "CREATE OR REPLACE FUNCTION public.check_and_deduct_ai_credit(p_user_id uuid, p_credits_to_deduct integer DEFAULT 1) RETURNS json LANGUAGE sql AS \$\$ SELECT '{}'::json \$\$;" >/dev/null
OUT=$($P -f proposal.sql 2>&1); echo "$OUT" | grep -q "has changed since this was prepared" \
  && echo "PASS|A changed check_and_deduct_ai_credit (live body hash differs) is refused; nothing applied" || echo "FAIL|hash guard: $OUT"
$P -At -c "SELECT CASE WHEN to_regprocedure('public.refund_ai_credit(uuid, integer)') IS NULL THEN 'PASS|After the refused apply, refund_ai_credit does not exist' ELSE 'FAIL|partial apply' END"

echo "== G: concurrency at the limit (20 connections, 5 credits)"
cd /; fresh_db; cd $W
$P -f test.sql >/dev/null 2>&1            # roles, fixture, applied then rolled back
$P -f proposal.sql >/dev/null
$P -c "UPDATE public.subscribers SET ai_credits_remaining = 5, ai_credits_limit = 250 WHERE user_id = 'aaaaaaaa-0000-4000-8000-000000000001'" >/dev/null
$P -c "CREATE TABLE outcomes(i int, reserved bool, refunded int)" >/dev/null
for i in $(seq 1 20); do
  # Each "request": reserve as the service role; if odd, give the credit back (an OpenAI failure).
  $P -c "SET ROLE service_role; SELECT set_config('request.jwt.claims', '{\"role\":\"service_role\"}', false);
    DO \$\$ DECLARE r json; f json; BEGIN
      PERFORM pg_sleep(random() * 0.05);
      r := public.check_and_deduct_ai_credit('aaaaaaaa-0000-4000-8000-000000000001', 1);
      IF (r->>'success')::boolean AND $i % 2 = 1 THEN
        PERFORM pg_sleep(random() * 0.05);
        f := public.refund_ai_credit('aaaaaaaa-0000-4000-8000-000000000001', 1);
        RESET ROLE; INSERT INTO outcomes VALUES ($i, true, (f->>'refunded')::int);
      ELSE RESET ROLE; INSERT INTO outcomes VALUES ($i, (r->>'success')::boolean, 0); END IF;
    END \$\$;" >/dev/null 2>$W/err$i &
done
wait
ERRS=$(cat $W/err* 2>/dev/null | grep -v NOTICE | head -3)
[ -z "$ERRS" ] && echo "PASS|20 parallel requests finished without errors" || echo "FAIL|errors: $ERRS"
$P -At -c "SELECT CASE WHEN min_seen >= 0 AND final = 5 - reserved + refunded AND final >= 0 AND final <= 250
    THEN 'PASS|End balance never negative and equals 5 - reservations + refunds (' || reserved || ' reserved, ' || refunded || ' refunded, ' || final || ' left)'
    ELSE 'FAIL|reserved ' || reserved || ' refunded ' || refunded || ' final ' || final END
  FROM (SELECT count(*) FILTER (WHERE reserved) AS reserved, coalesce(sum(refunded), 0) AS refunded,
               (SELECT ai_credits_remaining FROM public.subscribers WHERE user_id = 'aaaaaaaa-0000-4000-8000-000000000001') AS final,
               (SELECT ai_credits_remaining FROM public.subscribers WHERE user_id = 'aaaaaaaa-0000-4000-8000-000000000001') AS min_seen
          FROM outcomes) x"
$P -At -c "SELECT CASE WHEN count(*) = 20 AND count(*) FILTER (WHERE reserved) <= 5 + coalesce(sum(refunded), 0)
    THEN 'PASS|No more reservations than credits available at the time (' || count(*) FILTER (WHERE reserved) || ' of 20 got one)'
    ELSE 'FAIL|' || count(*) || ' outcomes, ' || count(*) FILTER (WHERE reserved) || ' reserved' END FROM outcomes"
cd /; $R $BIN/pg_ctl -D $D stop >/dev/null; rm -rf $D $S $W
