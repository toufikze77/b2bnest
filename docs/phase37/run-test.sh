#!/usr/bin/env bash
# Phase 37 tests on a DISPOSABLE local Postgres 16 (port 55490, unix socket only). Never touches production.
# From the repo root:   PG_RUN_USER=postgres bash docs/phase37/run-test.sh
# Builds production's credit functions exactly: Supabase shim + default privileges, Phase 35 fixture (production bodies,
# hash-checked) and proposal, Phase 36 fixture and proposal; checks the live-equivalent hashes, then docs/phase37.
set -u
D=/tmp/p37pg; S=/tmp/p37sock; PORT=55490; U=${PG_RUN_USER:-postgres}
R="setpriv --reuid=$U --regid=$(id -gn "$U") --clear-groups"
BIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
P="psql -h $S -p $PORT -U postgres -q -X"
$R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1; rm -rf $D $S; mkdir -p $D $S; chown "$U" $D $S
$R "$BIN/initdb" -U postgres -D $D >/dev/null 2>&1 && $R "$BIN/pg_ctl" -D $D -o "-p $PORT -k $S -c listen_addresses=''" -l $S/log start >/dev/null && sleep 2

$P -v ON_ERROR_STOP=1 -f scripts/staging/00_supabase_shim.sql >/dev/null 2>&1 || echo "FAIL|shim"
$P -v ON_ERROR_STOP=1 -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;" >/dev/null || echo "FAIL|default privileges"
for f in docs/phase35/fixture.sql docs/phase35/proposal.sql docs/phase36/fixture.sql docs/phase36/proposal.sql docs/phase37/fixture.sql; do
  $P -v ON_ERROR_STOP=1 -f $f >/dev/null || echo "FAIL|$f"
done

echo "== the replaced functions are byte-identical to production (2 Nov 2026)"
$P -At -c "select case when string_agg(p.oid::regprocedure::text || '=' || md5(p.prosrc), ' ' order by p.proname) =
  'check_and_deduct_ai_credit(uuid,integer,text,uuid)=659fcdfaeb9073f49f1661316465e459 get_ai_credits_info(uuid)=f6869e2ac74c56c9439f34e670508a79 refund_ai_credit(uuid,integer,text,uuid)=538c31c2514b2cad8aa83e1dc205517f'
  then 'PASS|live hashes = Phase 35 bodies' else 'FAIL|hashes: ' || string_agg(p.oid::regprocedure::text || '=' || md5(p.prosrc), ' ') end
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
  and p.proname in ('check_and_deduct_ai_credit','get_ai_credits_info','refund_ai_credit')"

echo "== suite"
$P -v ON_ERROR_STOP=1 -f docs/phase37/test.sql 2>&1 | sed -n 's/.*\(PASS|.*\)/\1/p; s/.*\(FAIL|.*\)/\1/p; /ERROR/p'

echo "== rollback refuses while customers hold purchased credits"
$P -v ON_ERROR_STOP=1 -f docs/phase37/rollback.sql 2>&1 | grep -q 'Customers have bought AI credits' && echo "PASS|rollback refused without force" || echo "FAIL|rollback not refused"
$P -At -c "select case when to_regclass('public.ai_credit_lots') is not null and (select count(*) from public.ai_credit_lots) = 8 then 'PASS|nothing removed by the refused rollback' else 'FAIL|refused rollback changed something' end"

echo "== forced rollback, then apply again"
$P -v ON_ERROR_STOP=1 -f docs/phase37/test-rollback.sql 2>&1 | sed -n 's/.*\(PASS|.*\)/\1/p; s/.*\(FAIL|.*\)/\1/p; /ERROR/p'

echo "== a second apply is refused"
$P -v ON_ERROR_STOP=1 -f docs/phase37/proposal.sql 2>&1 | grep -q 'Phase 37 already exists' && echo "PASS|second apply refused" || echo "FAIL|second apply"

echo "== a drifted credit function is refused before anything changes"
PGOPTIONS='-c app.phase37_force=on' $P -v ON_ERROR_STOP=1 -f docs/phase37/rollback.sql >/dev/null 2>&1 || echo "FAIL|forced rollback before drift"
$P -c "CREATE OR REPLACE FUNCTION public.get_ai_credits_info(p_user_id uuid DEFAULT auth.uid()) RETURNS json LANGUAGE sql AS \$\$ select '{}'::json \$\$" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/phase37/proposal.sql 2>&1 | grep -q 'differs from the Phase 35 body' && echo "PASS|drift refused" || echo "FAIL|drift"
$P -At -c "select case when to_regclass('public.ai_credit_lots') is null then 'PASS|nothing applied after the refusal' else 'FAIL|partial apply' end"

$R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1
