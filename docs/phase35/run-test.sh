#!/usr/bin/env bash
# Phase 35 tests on a DISPOSABLE local Postgres 16 (port 55470, unix socket only). Never touches production.
# From the repo root:   PG_RUN_USER=postgres bash docs/phase35/run-test.sh
#
# 1. The Supabase shim (scripts/staging/00_supabase_shim.sql) + Supabase's default privileges for new objects in public
#    (anon/authenticated/service_role get ALL on new tables and EXECUTE on new functions, as on the hosted platform), so
#    the proposal's REVOKEs are tested against the real defaults.
# 2. docs/phase35/fixture.sql: the functions Phase 35 replaces, copied verbatim from production (their md5 is checked
#    here against the production hashes before anything runs).
# 3. docs/phase35/test.sql: apply, a second apply refused, every rule, rollback to the exact production bodies, privileges
#    and guard log rows, then apply again.
set -u
ROOT=$(pwd); D=/tmp/p35pg; S=/tmp/p35sock; PORT=55470; U=${PG_RUN_USER:-postgres}
R="setpriv --reuid=$U --regid=$(id -gn "$U") --clear-groups"
BIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
P="psql -h $S -p $PORT -U postgres -q -X"
$R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1; rm -rf $D $S; mkdir -p $D $S; chown "$U" $D $S
$R "$BIN/initdb" -U postgres -D $D >/dev/null 2>&1 && $R "$BIN/pg_ctl" -D $D -o "-p $PORT -k $S -c listen_addresses=''" -l $S/log start >/dev/null && sleep 2

$P -v ON_ERROR_STOP=1 -f scripts/staging/00_supabase_shim.sql >/dev/null 2>&1 || echo "FAIL|shim"
$P -v ON_ERROR_STOP=1 -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;" >/dev/null || echo "FAIL|default privileges"
$P -v ON_ERROR_STOP=1 -f docs/phase35/fixture.sql >/dev/null || echo "FAIL|fixture"

echo "== fixture bodies are byte-identical to production"
$P -At -c "select case when string_agg(p.oid::regprocedure::text || '=' || md5(p.prosrc), ' ' order by p.proname) =
  'check_and_deduct_ai_credit(uuid,integer)=be23bdba849254ef8dda291c9beee2e5 get_ai_credits_info(uuid)=2cac6615542d149b7ae9b126b1388280 refund_ai_credit(uuid,integer)=95d05a5b34ea3acaeffd955c43eb67c0'
  then 'PASS|fixture hashes = production' else 'FAIL|fixture hashes: ' || string_agg(p.oid::regprocedure::text || '=' || md5(p.prosrc), ' ') end
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
  and p.proname in ('check_and_deduct_ai_credit','get_ai_credits_info','refund_ai_credit')"

echo "== suite"
$P -v ON_ERROR_STOP=1 -f docs/phase35/test.sql 2>&1 | sed -n 's/.*\(PASS|.*\)/\1/p; s/.*\(FAIL|.*\)/\1/p; /ERROR/p'

echo "== a second apply is refused"
$P -v ON_ERROR_STOP=1 -f docs/phase35/proposal.sql 2>&1 | grep -q 'Phase 35 already exists' && echo "PASS|second apply refused" || echo "FAIL|second apply"

echo "== a drifted function body is refused (before anything changes)"
$P -v ON_ERROR_STOP=1 -f docs/phase35/rollback.sql >/dev/null 2>&1
$P -c "CREATE OR REPLACE FUNCTION public.refund_ai_credit(p_user_id uuid, p_credits integer DEFAULT 1) RETURNS json LANGUAGE sql AS \$\$ select '{}'::json \$\$" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/phase35/proposal.sql 2>&1 | grep -q 'differs from the one this proposal was written against' && echo "PASS|drift refused" || echo "FAIL|drift"
$P -At -c "select case when to_regclass('public.ai_credit_ledger') is null then 'PASS|nothing applied after the refusal' else 'FAIL|partial apply' end"

$R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1
