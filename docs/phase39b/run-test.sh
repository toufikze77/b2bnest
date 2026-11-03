#!/usr/bin/env bash
# Phase 39b tests on a DISPOSABLE local Postgres 16 (port 55391, unix socket only). Never touches production.
# From the repo root:   PG_RUN_USER=postgres bash docs/phase39b/run-test.sh
# Builds production's shape: Supabase shim + default privileges, the Phase 35 / 36 / 37 / 31 fixtures and the applied
# docs/phase39/proposal.sql (hash-checked against production), then docs/phase39b.
set -u
D=/tmp/p39bpg; S=/tmp/p39bsock; PORT=55391; U=${PG_RUN_USER:-postgres}
R="setpriv --reuid=$U --regid=$(id -gn "$U") --clear-groups"
BIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
P="psql -h $S -p $PORT -U postgres -q -X"
$R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1; rm -rf $D $S; mkdir -p $D $S; chown "$U" $D $S
$R "$BIN/initdb" -U postgres -D $D >/dev/null 2>&1 && $R "$BIN/pg_ctl" -D $D -o "-p $PORT -k $S -c listen_addresses=''" -l $S/log start >/dev/null && sleep 2

$P -v ON_ERROR_STOP=1 -f scripts/staging/00_supabase_shim.sql >/dev/null 2>&1 || echo "FAIL|shim"
$P -v ON_ERROR_STOP=1 -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;" >/dev/null || echo "FAIL|default privileges"
for f in docs/phase35/fixture.sql docs/phase36/fixture.sql docs/phase37/fixture.sql docs/phase31/fixture.sql docs/phase39/proposal.sql; do
  $P -v ON_ERROR_STOP=1 -f $f >/dev/null || echo "FAIL|$f"
done

echo "== the Phase 39 function is byte-identical to production (3 Nov 2026)"
$P -At -c "select case when md5(p.prosrc) = '92b26481e8c7b688d055bde1c0360953'
  and (select array_agg(x order by x) from unnest(p.proacl::text[]) x) = array['authenticated=X/postgres','postgres=X/postgres']
  and (select old_md5 || ' ' || new_md5 from public.phase25_mfa_guard_log where fn = 'public.marketing_consent_record_signup()') = '663d400f45ba5bb535618ec278d92fe0 92b26481e8c7b688d055bde1c0360953'
  then 'PASS|record_signup body, privileges and guard row = production' else 'FAIL|production shape ' || md5(p.prosrc) end
  from pg_proc p where p.oid = 'public.marketing_consent_record_signup()'::regprocedure"

$P -v ON_ERROR_STOP=1 >/dev/null <<'SQL' || echo "FAIL|fingerprint"
CREATE SCHEMA t39b;
CREATE FUNCTION t39b.fingerprint() RETURNS text LANGUAGE sql AS $f$
  SELECT md5(concat_ws('|',
    (SELECT string_agg(p.oid::regprocedure::text || ':' || md5(p.prosrc) || ':' || coalesce(p.proacl::text, '') || ':' || p.prosecdef || ':' || coalesce(p.proconfig::text, ''), ',' ORDER BY p.oid::regprocedure::text)
       FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace),
    (SELECT string_agg(fn || ':' || kind || ':' || old_md5 || ':' || new_md5, ',' ORDER BY fn) FROM public.phase25_mfa_guard_log)))
$f$;
CREATE TABLE t39b.before AS SELECT t39b.fingerprint() AS fp;
CREATE TABLE t39b.guard_rows AS SELECT (SELECT count(*) FROM public.phase25_mfa_guard_log) AS n,
  (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.marketing_consent_set(boolean,text)'::regprocedure) AS set_md5;
GRANT USAGE ON SCHEMA t39b TO PUBLIC; GRANT SELECT ON ALL TABLES IN SCHEMA t39b TO PUBLIC;
SQL

echo "== suite"
$P -v ON_ERROR_STOP=1 -f docs/phase39b/test.sql 2>&1 | sed -n 's/.*\(PASS|.*\)/\1/p; s/.*\(FAIL|.*\)/\1/p; /ERROR/p'

echo "== a second apply is refused"
$P -v ON_ERROR_STOP=1 -f docs/phase39b/proposal.sql 2>&1 | grep -q 'Phase 39b already exists' && echo "PASS|second apply refused" || echo "FAIL|second apply"

echo "== rollback restores the exact Phase 39 state, then apply again"
$P -v ON_ERROR_STOP=1 -f docs/phase39b/test-rollback.sql 2>&1 | sed -n 's/.*\(PASS|.*\)/\1/p; s/.*\(FAIL|.*\)/\1/p; /ERROR/p'

echo "== drift is refused before anything changes"
$P -v ON_ERROR_STOP=1 -f docs/phase39b/rollback.sql >/dev/null 2>&1 || echo "FAIL|rollback before drift"
$P -v ON_ERROR_STOP=1 -f docs/phase39b/rollback.sql 2>&1 | grep -q 'Phase 39b is not applied' && echo "PASS|rollback refused when 39b is not applied" || echo "FAIL|rollback twice"
$P -c "REVOKE EXECUTE ON FUNCTION public.marketing_consent_record_signup() FROM authenticated; GRANT EXECUTE ON FUNCTION public.marketing_consent_record_signup() TO anon" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/phase39b/proposal.sql 2>&1 | grep -q 'privileges differ' && echo "PASS|changed privileges refused" || echo "FAIL|privilege drift"
$P -c "REVOKE EXECUTE ON FUNCTION public.marketing_consent_record_signup() FROM anon; GRANT EXECUTE ON FUNCTION public.marketing_consent_record_signup() TO authenticated;
  CREATE OR REPLACE FUNCTION public.marketing_consent_record_signup() RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS \$x\$ BEGIN RETURN '{}'::json; END \$x\$" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/phase39b/proposal.sql 2>&1 | grep -q 'differs from the Phase 39 body' && echo "PASS|a changed body is refused" || echo "FAIL|body drift"
$P -At -c "select case when md5(prosrc) <> '92b26481e8c7b688d055bde1c0360953' and position('phase25' in prosrc) = 0 then 'PASS|nothing applied after the refusals' else 'FAIL|partial apply' end from pg_proc where oid = 'public.marketing_consent_record_signup()'::regprocedure"

$R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1
