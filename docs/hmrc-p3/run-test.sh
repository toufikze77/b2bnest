#!/usr/bin/env bash
# HMRC P3 tests on a DISPOSABLE local Postgres (port 55404, unix socket only). Never touches production.
# From the repo root:   PG_RUN_USER=postgres bash docs/hmrc-p3/run-test.sh
set -u
D=/tmp/hp3pg; S=/tmp/hp3sock; PORT=55404; U=${PG_RUN_USER:-postgres}
R="setpriv --reuid=$U --regid=$(id -gn "$U") --clear-groups"
BIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
P="psql -h $S -p $PORT -U postgres -q -X"
$R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1; rm -rf $D $S; mkdir -p $D $S; chown "$U" $D $S
$R "$BIN/initdb" -U postgres -D $D >/dev/null 2>&1 && $R "$BIN/pg_ctl" -D $D -o "-p $PORT -k $S -c listen_addresses=''" -l $S/log start >/dev/null && sleep 2

$P -v ON_ERROR_STOP=1 -f scripts/staging/00_supabase_shim.sql >/dev/null 2>&1 || echo "FAIL|shim"
$P -v ON_ERROR_STOP=1 -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;" >/dev/null || echo "FAIL|default privileges"
# Production as of 6 Nov 2026: the earlier fixtures and every applied HMRC and demo proposal.
for f in docs/phase35/fixture.sql docs/phase36/fixture.sql docs/phase37/fixture.sql docs/phase31/fixture.sql docs/hmrc-p0/fixture.sql \
         docs/hmrc-p0/proposal.sql docs/hmrc-plan/proposal.sql docs/hmrc-p1-p2/proposal.sql docs/demo-readonly/fixture.sql docs/demo-readonly/proposal.sql; do
  $P -v ON_ERROR_STOP=1 -f $f >/dev/null 2>&1 || echo "FAIL|$f"
done

echo "== production shape (6 Nov 2026)"
$P -At -c "select case when md5(string_agg(relname, ',' order by relname)) = 'e99e2727c1ab5149215da05dea609062' and count(*) = 146
  then 'PASS|the 146 tables in public = production' else 'FAIL|table set' end from pg_class where relnamespace = 'public'::regnamespace and relkind in ('r','p')"
$P -At -c "select case when string_agg(proname || '=' || md5(prosrc), ' ' order by proname) =
  '_hmrc_audit_append_only=8f283e3f58f0d54343cff1e44a86a49e demo_readonly_guard=087b5fe2695b95b8ba2ba6eb195ba995 hmrc_connection_status=8d04b8c032d84f142acc0adf5bc59cb1 hmrc_manage_allowed=9304f069f05402aab62d343b3626cd65 hmrc_take_test_slot=be8ab280c2887bbd1a0937183d3f6167'
  then 'PASS|HMRC and demo function hashes = production' else 'FAIL|hashes: ' || string_agg(proname || '=' || md5(prosrc), ' ' order by proname) end
  from pg_proc where pronamespace = 'public'::regnamespace and proname in ('_hmrc_audit_append_only','demo_readonly_guard','hmrc_connection_status','hmrc_manage_allowed','hmrc_take_test_slot')"

$P -v ON_ERROR_STOP=1 >/dev/null <<'SQL' || echo "FAIL|fingerprint"
CREATE SCHEMA t2;
CREATE FUNCTION t2.fingerprint() RETURNS text LANGUAGE sql AS $f$
  SELECT md5(concat_ws('|',
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT p.oid::regprocedure::text || ':' || md5(p.prosrc) || ':' || p.prosecdef::text || ':' ||
        coalesce(array_to_string(p.proconfig, ';'), '') || ':' || coalesce((SELECT string_agg(x, ',' ORDER BY x) FROM unnest(p.proacl::text[]) x), '') AS v
       FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace) s),
    (SELECT string_agg(c.relname || ':' || c.relrowsecurity::text || ':' || coalesce((SELECT string_agg(x, ',' ORDER BY x) FROM unnest(c.relacl::text[]) x), ''), ',' ORDER BY c.relname)
       FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r','p')),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT t.tgrelid::regclass::text || '.' || t.tgname AS v
       FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid WHERE c.relnamespace = 'public'::regnamespace AND NOT t.tgisinternal) s),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT tablename || '.' || policyname || ':' || cmd || ':' || permissive AS v FROM pg_policies WHERE schemaname = 'public') s),
    (SELECT string_agg(conname || ':' || pg_get_constraintdef(oid), ',' ORDER BY conname) FROM pg_constraint WHERE conrelid = 'public.hmrc_audit_log'::regclass),
    (SELECT string_agg(g::text, ',' ORDER BY g::text) FROM public.phase25_mfa_guard_log g)))
$f$;
CREATE TABLE t2.before AS SELECT t2.fingerprint() AS fp;
GRANT USAGE ON SCHEMA t2 TO PUBLIC;
SQL

echo "== apply, then an empty rollback restores the exact state"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p3/proposal.sql >/dev/null 2>&1 || { echo "FAIL|apply"; $P -v ON_ERROR_STOP=1 -f docs/hmrc-p3/proposal.sql 2>&1 | grep ERROR | head -3; }
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p3/rollback.sql >/dev/null 2>&1 || echo "FAIL|empty rollback"
$P -At -c "select case when t2.fingerprint() = (select fp from t2.before) then 'PASS|empty rollback: functions, privileges, tables, triggers, policies, audit rule and guard log exactly as before' else 'FAIL|empty rollback not exact' end"

echo "== apply again and run the suite"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p3/proposal.sql >/dev/null 2>&1 && echo "PASS|re-apply after rollback works" || echo "FAIL|re-apply"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p3/test.sql 2>&1 | sed -n 's/.*\(PASS|.*\)/\1/p; s/.*\(FAIL|.*\)/\1/p; /ERROR/p'
$P -v ON_ERROR_STOP=1 -f docs/demo-readonly/check-coverage.sql 2>&1 | grep -q 'DEMO_GUARD_OK' && echo "PASS|demo coverage check still passes (no new table)" || echo "FAIL|demo coverage"

echo "== a second apply is refused"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p3/proposal.sql 2>&1 | grep -q 'HMRC P3 already exists' && echo "PASS|second apply refused" || echo "FAIL|second apply"

echo "== rollback with obligations rows: refused, then forced"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p3/rollback.sql 2>&1 | grep -q 'obligations row' && echo "PASS|rollback refused without force" || echo "FAIL|rollback not refused"
$P -At -c "select case when to_regprocedure('public.hmrc_take_obligations_slot(uuid,uuid,text,text,integer)') is not null then 'PASS|refused rollback changed nothing' else 'FAIL|partial rollback' end"
PGOPTIONS='-c app.hmrc_p3_force=on' $P -v ON_ERROR_STOP=1 -f docs/hmrc-p3/rollback.sql >/dev/null 2>&1 || echo "FAIL|forced rollback"
$P -At -c "select case when to_regprocedure('public.hmrc_take_obligations_slot(uuid,uuid,text,text,integer)') is null
  and (select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.hmrc_audit_log'::regclass and conname = 'hal_event') like '%''test_result''::text]))) NOT VALID'
  and (select count(*) from public.hmrc_audit_log where event in ('obligations_call','obligations_result')) = 12
  then 'PASS|forced rollback: function gone, the old rule back (NOT VALID), the history kept' else 'FAIL|forced rollback' end"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p3/rollback.sql 2>&1 | grep -q 'not applied' && echo "PASS|rollback when not applied is refused" || echo "FAIL|rollback when not applied"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p3/proposal.sql >/dev/null 2>&1 && echo "PASS|apply after a forced rollback works" || echo "FAIL|apply after forced rollback"

echo "== drift is refused before anything changes"
PGOPTIONS='-c app.hmrc_p3_force=on' $P -v ON_ERROR_STOP=1 -f docs/hmrc-p3/rollback.sql >/dev/null 2>&1 || echo "FAIL|rollback before drift"
$P -c "ALTER TABLE public.hmrc_audit_log DROP CONSTRAINT hal_event; ALTER TABLE public.hmrc_audit_log ADD CONSTRAINT hal_event CHECK (event IN ('connect_started','connected','refreshed','refresh_failed','disconnected','refused','test_call','test_result','other')) NOT VALID" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p3/proposal.sql 2>&1 | grep -q 'event rule differs' && echo "PASS|a changed audit event rule is refused" || echo "FAIL|event rule drift"
$P -c "ALTER TABLE public.hmrc_audit_log DROP CONSTRAINT hal_event; ALTER TABLE public.hmrc_audit_log ADD CONSTRAINT hal_event CHECK (event IN ('connect_started','connected','refreshed','refresh_failed','disconnected','refused','test_call','test_result')) NOT VALID" >/dev/null
$P -c "CREATE OR REPLACE FUNCTION public.hmrc_manage_allowed(p_company uuid, p_user uuid) RETURNS text LANGUAGE sql STABLE SET search_path TO '' AS 'select ''ok''::text'" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p3/proposal.sql 2>&1 | grep -q 'hmrc_manage_allowed(uuid,uuid) differs' && echo "PASS|a changed access rule is refused" || echo "FAIL|function drift"
$P -At -c "select case when to_regprocedure('public.hmrc_take_obligations_slot(uuid,uuid,text,text,integer)') is null then 'PASS|nothing applied after the refusal' else 'FAIL|partial apply' end"

$R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1
