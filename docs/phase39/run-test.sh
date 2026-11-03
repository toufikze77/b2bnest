#!/usr/bin/env bash
# Phase 39 tests on a DISPOSABLE local Postgres 16 (port 55390, unix socket only). Never touches production.
# From the repo root:   PG_RUN_USER=postgres bash docs/phase39/run-test.sh
# Builds production's shape: Supabase shim + default privileges, the Phase 35 / 36 / 37 / 31 fixtures (mfa_ok,
# require_aal2_if_enrolled, the guard log and _access_state_for, verbatim and hash-checked), then docs/phase39.
set -u
D=/tmp/p39pg; S=/tmp/p39sock; PORT=55390; U=${PG_RUN_USER:-postgres}
R="setpriv --reuid=$U --regid=$(id -gn "$U") --clear-groups"
BIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
P="psql -h $S -p $PORT -U postgres -q -X"
$R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1; rm -rf $D $S; mkdir -p $D $S; chown "$U" $D $S
$R "$BIN/initdb" -U postgres -D $D >/dev/null 2>&1 && $R "$BIN/pg_ctl" -D $D -o "-p $PORT -k $S -c listen_addresses=''" -l $S/log start >/dev/null && sleep 2

$P -v ON_ERROR_STOP=1 -f scripts/staging/00_supabase_shim.sql >/dev/null 2>&1 || echo "FAIL|shim"
$P -v ON_ERROR_STOP=1 -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;" >/dev/null || echo "FAIL|default privileges"
for f in docs/phase35/fixture.sql docs/phase36/fixture.sql docs/phase37/fixture.sql docs/phase31/fixture.sql; do
  $P -v ON_ERROR_STOP=1 -f $f >/dev/null || echo "FAIL|$f"
done

echo "== the helpers are byte-identical to production (3 Nov 2026)"
$P -At -c "select case when string_agg(p.proname || '=' || md5(p.prosrc), ' ' order by p.proname) =
  '_access_state_for=292e158f87569a1b7bdbe32e64da0a67 mfa_ok=20516f2ec203220b3ac08d1230c7c306 require_aal2_if_enrolled=10b2ae7bd2f9a94ea20598f19b8aebf2'
  then 'PASS|helper hashes = production' else 'FAIL|hashes: ' || string_agg(p.proname || '=' || md5(p.prosrc), ' ' order by p.proname) end
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
  and p.proname in ('_access_state_for','mfa_ok','require_aal2_if_enrolled')"

# A fingerprint of everything Phase 39 could touch, taken before it is applied (compared after the forced rollback).
$P -v ON_ERROR_STOP=1 >/dev/null <<'SQL' || echo "FAIL|fingerprint"
CREATE SCHEMA t39;
CREATE FUNCTION t39.fingerprint() RETURNS text LANGUAGE sql AS $f$
  SELECT md5(concat_ws('|',
    (SELECT string_agg(c.relname || ':' || c.relkind::text || ':' || coalesce(c.relacl::text, ''), ',' ORDER BY c.relname) FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace),
    (SELECT string_agg(p.oid::regprocedure::text || ':' || md5(p.prosrc) || ':' || coalesce(p.proacl::text, ''), ',' ORDER BY p.oid::regprocedure::text) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace),
    (SELECT string_agg(schemaname || '.' || tablename || '.' || policyname || ':' || permissive || ':' || cmd::text || ':' || coalesce(qual, '') || ':' || coalesce(with_check, ''), ',' ORDER BY 1) FROM pg_policies),
    (SELECT string_agg(t.tgrelid::regclass::text || '.' || t.tgname, ',' ORDER BY 1) FROM pg_trigger t WHERE NOT t.tgisinternal),
    (SELECT string_agg(g::text, ',' ORDER BY g::text) FROM public.phase25_mfa_guard_log g)))
$f$;
CREATE TABLE t39.before AS SELECT t39.fingerprint() AS fp;
SQL

echo "== suite"
$P -v ON_ERROR_STOP=1 -f docs/phase39/test.sql 2>&1 | sed -n 's/.*\(PASS|.*\)/\1/p; s/.*\(FAIL|.*\)/\1/p; /ERROR/p'

echo "== rollback refuses while people have saved items or consent choices"
$P -v ON_ERROR_STOP=1 -f docs/phase39/rollback.sql 2>&1 | grep -q 'People have saved free-tool items' && echo "PASS|rollback refused without force" || echo "FAIL|rollback not refused"
$P -At -c "select case when to_regclass('public.free_tool_items') is not null and (select count(*) from public.free_tool_items) > 50 and (select count(*) from public.marketing_consents) = 4 then 'PASS|nothing removed by the refused rollback' else 'FAIL|refused rollback changed something' end"

echo "== forced rollback restores the exact state, then apply again"
$P -v ON_ERROR_STOP=1 -f docs/phase39/test-rollback.sql 2>&1 | sed -n 's/.*\(PASS|.*\)/\1/p; s/.*\(FAIL|.*\)/\1/p; /ERROR/p'

echo "== a second apply is refused"
$P -v ON_ERROR_STOP=1 -f docs/phase39/proposal.sql 2>&1 | grep -q 'Phase 39 already exists' && echo "PASS|second apply refused" || echo "FAIL|second apply"

echo "== an empty rollback needs no force"
$P -v ON_ERROR_STOP=1 -f docs/phase39/rollback.sql >/dev/null 2>&1 && echo "PASS|rollback of an empty Phase 39 runs without force" || echo "FAIL|empty rollback"

echo "== drift is refused before anything changes"
$P -c "CREATE FUNCTION public.marketing_consent_set(boolean) RETURNS void LANGUAGE sql AS 'select'" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/phase39/proposal.sql 2>&1 | grep -q 'function name is already taken' && echo "PASS|a taken function name is refused" || echo "FAIL|name drift"
$P -c "DROP FUNCTION public.marketing_consent_set(boolean); CREATE OR REPLACE FUNCTION public.mfa_ok() RETURNS boolean LANGUAGE sql STABLE AS 'select true'" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/phase39/proposal.sql 2>&1 | grep -q 'a helper differs' && echo "PASS|a changed helper is refused" || echo "FAIL|helper drift"
$P -At -c "select case when to_regclass('public.free_tool_items') is null and to_regclass('public.marketing_consents') is null and to_regprocedure('public.free_tools_write_ok()') is null then 'PASS|nothing applied after the refusals' else 'FAIL|partial apply' end"

$R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1
