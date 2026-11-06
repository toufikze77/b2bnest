#!/usr/bin/env bash
# Demo read-only tests on a DISPOSABLE local Postgres (port 55403, unix socket only). Never touches production.
# From the repo root:   PG_RUN_USER=postgres bash docs/demo-readonly/run-test.sh
set -u
D=/tmp/demopg; S=/tmp/demosock; PORT=55403; U=${PG_RUN_USER:-postgres}
R="setpriv --reuid=$U --regid=$(id -gn "$U") --clear-groups"
BIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
P="psql -h $S -p $PORT -U postgres -q -X"
$R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1; rm -rf $D $S; mkdir -p $D $S; chown "$U" $D $S
$R "$BIN/initdb" -U postgres -D $D >/dev/null 2>&1 && $R "$BIN/pg_ctl" -D $D -o "-p $PORT -k $S -c listen_addresses=''" -l $S/log start >/dev/null && sleep 2

$P -v ON_ERROR_STOP=1 -f scripts/staging/00_supabase_shim.sql >/dev/null 2>&1 || echo "FAIL|shim"
$P -v ON_ERROR_STOP=1 -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;" >/dev/null || echo "FAIL|default privileges"
for f in docs/phase35/fixture.sql docs/phase36/fixture.sql docs/phase37/fixture.sql docs/phase31/fixture.sql docs/hmrc-p0/fixture.sql \
         docs/hmrc-p0/proposal.sql docs/hmrc-plan/proposal.sql docs/hmrc-p1-p2/proposal.sql docs/demo-readonly/fixture.sql; do
  $P -v ON_ERROR_STOP=1 -f $f >/dev/null 2>&1 || echo "FAIL|$f"
done

echo "== production shape (6 Nov 2026)"
$P -At -c "select case when md5(string_agg(relname, ',' order by relname)) = 'bb4652cf005ef3a9ee10f4e0f9bea2c4' and count(*) = 145
  then 'PASS|the 145 tables in public = production' else 'FAIL|table set' end from pg_class where relnamespace = 'public'::regnamespace and relkind in ('r','p')"
$P -At -c "select case when string_agg(proname || '=' || md5(prosrc), ' ' order by proname) = 'mfa_ok=20516f2ec203220b3ac08d1230c7c306 require_aal2_if_enrolled=10b2ae7bd2f9a94ea20598f19b8aebf2'
  then 'PASS|mfa_ok and require_aal2_if_enrolled = production' else 'FAIL|aal2 helper hashes' end
  from pg_proc where pronamespace = 'public'::regnamespace and proname in ('mfa_ok', 'require_aal2_if_enrolled')"

$P -v ON_ERROR_STOP=1 >/dev/null <<'SQL' || echo "FAIL|fingerprint"
CREATE SCHEMA t2;
CREATE FUNCTION t2.fingerprint() RETURNS text LANGUAGE sql AS $f$
  SELECT md5(concat_ws('|',
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT p.oid::regprocedure::text || ':' || md5(p.prosrc) || ':' || p.prosecdef::text || ':' ||
        coalesce(array_to_string(p.proconfig, ';'), '') || ':' || coalesce((SELECT string_agg(x, ',' ORDER BY x) FROM unnest(p.proacl::text[]) x), '') AS v
       FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace) s),
    (SELECT string_agg(c.relname || ':' || c.relrowsecurity::text || ':' || coalesce((SELECT string_agg(x, ',' ORDER BY x) FROM unnest(c.relacl::text[]) x), ''), ',' ORDER BY c.relname)
       FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r','p')),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT t.tgrelid::regclass::text || '.' || t.tgname || ':' || t.tgfoid::regprocedure::text AS v
       FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid WHERE c.relnamespace = 'public'::regnamespace AND NOT t.tgisinternal) s),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT tablename || '.' || policyname || ':' || cmd || ':' || permissive || ':' || roles::text AS v
       FROM pg_policies WHERE schemaname = 'public') s),
    (SELECT string_agg(g::text, ',' ORDER BY g::text) FROM public.phase25_mfa_guard_log g)))
$f$;
CREATE TABLE t2.before AS SELECT t2.fingerprint() AS fp;
GRANT USAGE ON SCHEMA t2 TO PUBLIC;
SQL

echo "== apply, then an empty rollback restores the exact state"
$P -v ON_ERROR_STOP=1 -f docs/demo-readonly/proposal.sql >/dev/null 2>&1 || { echo "FAIL|apply"; $P -v ON_ERROR_STOP=1 -f docs/demo-readonly/proposal.sql 2>&1 | grep ERROR | head -3; }
$P -v ON_ERROR_STOP=1 -f docs/demo-readonly/rollback.sql >/dev/null 2>&1 || echo "FAIL|empty rollback"
$P -At -c "select case when t2.fingerprint() = (select fp from t2.before) then 'PASS|empty rollback: functions, privileges, tables, triggers, policies and guard log exactly as before' else 'FAIL|empty rollback not exact' end"

echo "== apply again and run the suite"
$P -v ON_ERROR_STOP=1 -f docs/demo-readonly/proposal.sql >/dev/null 2>&1 && echo "PASS|re-apply after rollback works" || echo "FAIL|re-apply"
$P -v ON_ERROR_STOP=1 -f docs/demo-readonly/test.sql 2>&1 | sed -n 's/.*\(PASS|.*\)/\1/p; s/.*\(FAIL|.*\)/\1/p; /ERROR/p'

echo "== a new table without the guard is caught"
$P -c "CREATE TABLE public.new_feature_items (id uuid PRIMARY KEY, organization_id uuid)" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/demo-readonly/check-coverage.sql 2>&1 | grep -q 'DEMO_GUARD_MISSING: tables neither guarded nor allowed: new_feature_items' \
  && echo "PASS|coverage check fails for a new table that is neither guarded nor allowed" || echo "FAIL|coverage check missed the new table"
$P -c "DROP TABLE public.new_feature_items" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/demo-readonly/check-coverage.sql 2>&1 | grep -q 'DEMO_GUARD_OK' && echo "PASS|coverage check passes again once the table is gone" || echo "FAIL|coverage after drop"

echo "== a second apply is refused"
$P -v ON_ERROR_STOP=1 -f docs/demo-readonly/proposal.sql 2>&1 | grep -q 'Demo read-only already exists' && echo "PASS|second apply refused" || echo "FAIL|second apply"

echo "== rollback with someone listed: refused, then forced (exact)"
$P -v ON_ERROR_STOP=1 -f docs/demo-readonly/rollback.sql 2>&1 | grep -q 'still listed in demo_readonly_users' && echo "PASS|rollback refused without force" || echo "FAIL|rollback not refused"
$P -At -c "select case when (select count(*) from pg_trigger where tgname = 'a0_demo_readonly_guard') = 133 then 'PASS|refused rollback changed nothing' else 'FAIL|partial rollback' end"
$P -c "delete from public.todos; delete from public.invoices; delete from public.notifications; delete from public.integration_audit_logs; delete from public.banking_audit_logs;
  delete from public.audit_logs; delete from public.security_audit_logs; delete from public.payment_audit_logs; delete from public.user_notification_preferences;
  delete from public.user_favorites; delete from public.crm_contacts; delete from public.hmrc_settings; delete from public.ai_credit_ledger; delete from public.user_2fa_codes;
  delete from public.template_events; delete from auth.users where email like '%@example.test'" >/dev/null
$P -At -c "select case when (select count(*) from public.demo_readonly_users) = 0 then 'PASS|deleting the auth user removes their row (ON DELETE CASCADE)' else 'FAIL|cascade' end"
$P -c "INSERT INTO auth.users (id, email) VALUES ('de00de00-0000-4000-8000-000000000001', 'demo@example.test'); INSERT INTO public.demo_readonly_users (user_id) VALUES ('de00de00-0000-4000-8000-000000000001')" >/dev/null
PGOPTIONS='-c app.demo_readonly_force=on' $P -v ON_ERROR_STOP=1 -f docs/demo-readonly/rollback.sql >/dev/null 2>&1 || echo "FAIL|forced rollback"
$P -c "DELETE FROM auth.users WHERE email = 'demo@example.test'" >/dev/null
$P -At -c "select case when t2.fingerprint() = (select fp from t2.before) then 'PASS|forced rollback: triggers, both functions, guard log row and table removed exactly' else 'FAIL|forced rollback not exact' end"
$P -v ON_ERROR_STOP=1 -f docs/demo-readonly/rollback.sql 2>&1 | grep -q 'not applied' && echo "PASS|rollback when not applied is refused" || echo "FAIL|rollback when not applied"
$P -v ON_ERROR_STOP=1 -f docs/demo-readonly/proposal.sql >/dev/null 2>&1 && echo "PASS|apply after a forced rollback works" || echo "FAIL|apply after forced rollback"

echo "== drift is refused before anything changes"
$P -v ON_ERROR_STOP=1 -f docs/demo-readonly/rollback.sql >/dev/null 2>&1 || echo "FAIL|rollback before drift"
$P -c "CREATE TABLE public.surprise_table (id uuid)" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/demo-readonly/proposal.sql 2>&1 | grep -q 'tables in public differ' && echo "PASS|a new table since 6 Nov is refused" || echo "FAIL|table drift"
$P -At -c "select case when to_regclass('public.demo_readonly_users') is null and (select count(*) from pg_trigger where tgname = 'a0_demo_readonly_guard') = 0 then 'PASS|nothing applied after the refusal' else 'FAIL|partial apply' end"
$P -c "DROP TABLE public.surprise_table" >/dev/null
$P -c "CREATE FUNCTION pg_temp_early() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN RETURN NEW; END'; CREATE TRIGGER a00_early BEFORE INSERT ON public.todos FOR EACH ROW EXECUTE FUNCTION pg_temp_early()" >/dev/null 2>&1
$P -v ON_ERROR_STOP=1 -f docs/demo-readonly/proposal.sql 2>&1 | grep -q 'sorts before a0_demo_readonly_guard' && echo "PASS|a trigger that would fire before the guard is refused" || echo "FAIL|trigger-order drift"
$P -c "DROP TRIGGER a00_early ON public.todos; DROP FUNCTION pg_temp_early()" >/dev/null
$P -c "CREATE OR REPLACE FUNCTION public.require_aal2_if_enrolled() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS 'BEGIN RETURN; END'" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/demo-readonly/proposal.sql 2>&1 | grep -q 'differs from production' && echo "PASS|a changed require_aal2_if_enrolled() is refused" || echo "FAIL|function drift"
$P -At -c "select case when to_regprocedure('public.is_demo_readonly()') is null then 'PASS|nothing applied after the refusal' else 'FAIL|partial apply' end"

$R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1
