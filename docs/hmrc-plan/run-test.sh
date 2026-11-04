#!/usr/bin/env bash
# HMRC plan rule tests on a DISPOSABLE local Postgres 16 (port 55401, unix socket only). Never touches production.
# From the repo root:   PG_RUN_USER=postgres bash docs/hmrc-plan/run-test.sh
# Builds production's shape: shim + default privileges, the Phase 35 / 36 / 37 / 31 fixtures, docs/hmrc-p0/fixture.sql
# and docs/hmrc-p0/proposal.sql (applied in production), hash-checked, then docs/hmrc-plan.
set -u
D=/tmp/hplpg; S=/tmp/hplsock; PORT=55401; U=${PG_RUN_USER:-postgres}
R="setpriv --reuid=$U --regid=$(id -gn "$U") --clear-groups"
BIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
P="psql -h $S -p $PORT -U postgres -q -X"
$R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1; rm -rf $D $S; mkdir -p $D $S; chown "$U" $D $S
$R "$BIN/initdb" -U postgres -D $D >/dev/null 2>&1 && $R "$BIN/pg_ctl" -D $D -o "-p $PORT -k $S -c listen_addresses=''" -l $S/log start >/dev/null && sleep 2

$P -v ON_ERROR_STOP=1 -f scripts/staging/00_supabase_shim.sql >/dev/null 2>&1 || echo "FAIL|shim"
$P -v ON_ERROR_STOP=1 -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;" >/dev/null || echo "FAIL|default privileges"
for f in docs/phase35/fixture.sql docs/phase36/fixture.sql docs/phase37/fixture.sql docs/phase31/fixture.sql docs/hmrc-p0/fixture.sql docs/hmrc-p0/proposal.sql; do
  $P -v ON_ERROR_STOP=1 -f $f >/dev/null 2>&1 || echo "FAIL|$f"
done

echo "== the functions are byte-identical to production (4 Nov 2026)"
$P -At -c "select case when string_agg(p.proname || '=' || md5(p.prosrc), ' ' order by p.proname) =
  '_access_state_for=292e158f87569a1b7bdbe32e64da0a67 hmrc_audit_events=47b3d4d71f94b27c947a4f6e007bc182 hmrc_can_manage=1d40a67edbcea7a53e09f9acb986630f hmrc_connection_status=588c2a91667fb727284ad0c72608274d hmrc_manage_allowed=9da6644ed17385ccb8c0d184e206ccab user_is_organization_admin=c6dd628541413ec82565a6676a55a767 user_is_organization_member=1fb55538d44b2451875f8baf1b6e4388'
  then 'PASS|function hashes = production' else 'FAIL|hashes: ' || string_agg(p.proname || '=' || md5(p.prosrc), ' ' order by p.proname) end
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
  and p.proname in ('_access_state_for','hmrc_audit_events','hmrc_can_manage','hmrc_connection_status','hmrc_manage_allowed','user_is_organization_admin','user_is_organization_member')"
$P -At -c "select case when (select old_md5 || ' ' || new_md5 from public.phase25_mfa_guard_log where fn = 'public.hmrc_connection_status(uuid)') = '6046f16dab5ce5e796223bab7ae3cca8 588c2a91667fb727284ad0c72608274d'
  then 'PASS|hmrc_connection_status guard log row = production' else 'FAIL|guard row' end"

$P -v ON_ERROR_STOP=1 >/dev/null <<'SQL' || echo "FAIL|fingerprint"
CREATE SCHEMA t1;
CREATE FUNCTION t1.fingerprint() RETURNS text LANGUAGE sql AS $f$
  SELECT md5(concat_ws('|',
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT p.oid::regprocedure::text || ':' || md5(p.prosrc) || ':' || coalesce((SELECT string_agg(x, ',' ORDER BY x) FROM unnest(p.proacl::text[]) x), '')
        || ':' || p.prosecdef || ':' || coalesce(p.proconfig::text, '') || ':' || p.provolatile::text AS v FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace) s),
    (SELECT string_agg(g::text, ',' ORDER BY g::text) FROM public.phase25_mfa_guard_log g)))
$f$;
CREATE TABLE t1.before AS SELECT t1.fingerprint() AS fp;
GRANT USAGE ON SCHEMA t1 TO PUBLIC;
SQL

echo "== suite"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-plan/test.sql 2>&1 | sed -n 's/.*\(PASS|.*\)/\1/p; s/.*\(FAIL|.*\)/\1/p; /ERROR/p'

echo "== a second apply is refused"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-plan/proposal.sql 2>&1 | grep -q 'HMRC plan rule already exists' && echo "PASS|second apply refused" || echo "FAIL|second apply"

echo "== rollback restores the exact HMRC P0 state, then apply again"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-plan/test-rollback.sql 2>&1 | sed -n 's/.*\(PASS|.*\)/\1/p; s/.*\(FAIL|.*\)/\1/p; /ERROR/p'

echo "== drift is refused before anything changes"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-plan/rollback.sql >/dev/null 2>&1 || echo "FAIL|rollback before drift"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-plan/rollback.sql 2>&1 | grep -q 'the HMRC plan rule is not applied' && echo "PASS|rollback refused when the rule is not applied" || echo "FAIL|rollback twice"
$P -c "GRANT EXECUTE ON FUNCTION public.hmrc_manage_allowed(uuid,uuid) TO authenticated" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/hmrc-plan/proposal.sql 2>&1 | grep -q 'privileges differ from production' && echo "PASS|changed privileges refused" || echo "FAIL|privilege drift"
$P -c "REVOKE EXECUTE ON FUNCTION public.hmrc_manage_allowed(uuid,uuid) FROM authenticated; UPDATE public.phase25_mfa_guard_log SET new_md5 = 'x' WHERE fn = 'public.hmrc_connection_status(uuid)'" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/hmrc-plan/proposal.sql 2>&1 | grep -q 'guard log row for hmrc_connection_status differs' && echo "PASS|a changed guard log row is refused" || echo "FAIL|guard drift"
$P -c "UPDATE public.phase25_mfa_guard_log SET new_md5 = '588c2a91667fb727284ad0c72608274d' WHERE fn = 'public.hmrc_connection_status(uuid)'; CREATE OR REPLACE FUNCTION public.hmrc_audit_events(p_company uuid, p_limit integer DEFAULT 50) RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS 'select ''[]''::json'" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/hmrc-plan/proposal.sql 2>&1 | grep -q 'hmrc_audit_events(uuid,integer) differs' && echo "PASS|a changed HMRC function is refused" || echo "FAIL|function drift"
$P -At -c "select case when md5(prosrc) = '9da6644ed17385ccb8c0d184e206ccab' then 'PASS|nothing applied after the refusals' else 'FAIL|partial apply' end from pg_proc where oid = 'public.hmrc_manage_allowed(uuid,uuid)'::regprocedure"

$R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1
