#!/usr/bin/env bash
# HMRC P6 tests on a DISPOSABLE local Postgres (port 55407, unix socket only). Never touches production.
# From the repo root:   PG_RUN_USER=postgres bash docs/hmrc-p6/run-test.sh
set -u
D=/tmp/hp6pg; S=/tmp/hp6sock; PORT=55408; U=${PG_RUN_USER:-postgres}
R="setpriv --reuid=$U --regid=$(id -gn "$U") --clear-groups"
BIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
P="psql -h $S -p $PORT -U postgres -q -X"
$R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1; rm -rf $D $S; mkdir -p $D $S; chown "$U" $D $S
$R "$BIN/initdb" -U postgres -D $D >/dev/null 2>&1 && $R "$BIN/pg_ctl" -D $D -o "-p $PORT -k $S -c listen_addresses=''" -l $S/log start >/dev/null && sleep 2

$P -v ON_ERROR_STOP=1 -f scripts/staging/00_supabase_shim.sql >/dev/null 2>&1 || echo "FAIL|shim"
$P -v ON_ERROR_STOP=1 -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;" >/dev/null || echo "FAIL|default privileges"
# Production as of 8 Nov 2026: the earlier fixtures, every applied HMRC and demo proposal, P4, P4b, P4b option B and P5.
for f in docs/phase35/fixture.sql docs/phase36/fixture.sql docs/phase37/fixture.sql docs/phase31/fixture.sql docs/hmrc-p0/fixture.sql \
         docs/hmrc-p0/proposal.sql docs/hmrc-plan/proposal.sql docs/hmrc-p1-p2/proposal.sql docs/hmrc-p3/proposal.sql \
         docs/hmrc-p4/fixture.sql docs/demo-readonly/fixture.sql docs/demo-readonly/proposal.sql docs/hmrc-p4/proposal.sql docs/hmrc-p4b/fixture.sql \
         docs/hmrc-p4b/proposal.sql docs/hmrc-p4b/decision-b-function.sql docs/hmrc-p5/fixture.sql docs/hmrc-p5/proposal.sql docs/hmrc-p6/fixture.sql; do
  $P -v ON_ERROR_STOP=1 -f $f >/dev/null 2>&1 || echo "FAIL|$f"
done

echo "== production shape (8 Nov 2026, HMRC P0-P5 applied)"
$P -At -c "select case when md5(string_agg(relname, ',' order by relname)) = 'e99e2727c1ab5149215da05dea609062' and count(*) = 146
  then 'PASS|the 146 tables in public = production' else 'FAIL|table set' end from pg_class where relnamespace = 'public'::regnamespace and relkind in ('r','p')"
$P -At -c "select case when string_agg(p.proname || '=' || md5(p.prosrc), ' ' order by p.proname) = '_hmrc_audit_append_only=8f283e3f58f0d54343cff1e44a86a49e demo_readonly_guard=087b5fe2695b95b8ba2ba6eb195ba995 hmrc_manage_allowed=9304f069f05402aab62d343b3626cd65 hmrc_take_obligations_slot=58c7d543191e1960d2e6bd01ca643b0b mfa_ok=20516f2ec203220b3ac08d1230c7c306 user_is_organization_admin=c6dd628541413ec82565a6676a55a767 vat_company_return_preview=9046b04074a9edd2adb2a45c838bb389'
  then 'PASS|the functions P6 relies on = production' else 'FAIL|function sources: ' || string_agg(p.proname || '=' || md5(p.prosrc), ' ' order by p.proname) end
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('_hmrc_audit_append_only', 'demo_readonly_guard', 'hmrc_manage_allowed', 'hmrc_take_obligations_slot', 'mfa_ok', 'user_is_organization_admin', 'vat_company_return_preview')"

$P -v ON_ERROR_STOP=1 >/dev/null <<'SQL' || echo "FAIL|fingerprint"
CREATE SCHEMA t2;
CREATE FUNCTION t2.fingerprint() RETURNS text LANGUAGE sql AS $f$
  SELECT md5(concat_ws('|',
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT p.oid::regprocedure::text || ':' || md5(p.prosrc) || ':' || p.prosecdef::text || ':' ||
        coalesce((SELECT string_agg(x, ',' ORDER BY x) FROM unnest(p.proacl::text[]) x), '') AS v FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace) s),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT c.relname || '.' || a.attname || ':' || format_type(a.atttypid, a.atttypmod) AS v
       FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r') s),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT conrelid::regclass::text || '.' || conname || ':' || pg_get_constraintdef(oid) AS v FROM pg_constraint
      WHERE conrelid = 'public.hmrc_audit_log'::regclass) s),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT t.tgrelid::regclass::text || '.' || t.tgname AS v FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
      WHERE c.relnamespace = 'public'::regnamespace AND NOT t.tgisinternal) s),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT tablename || '.' || policyname || ':' || cmd || ':' || coalesce(qual, '') || ':' || coalesce(with_check, '') AS v FROM pg_policies WHERE schemaname = 'public') s)))
$f$;
CREATE TABLE t2.before AS SELECT t2.fingerprint() AS fp;
GRANT USAGE ON SCHEMA t2 TO PUBLIC;
SQL
same() { $P -At -c "select case when t2.fingerprint() = (select fp from t2.before) then 'PASS|$1' else 'FAIL|$1' end"; }

echo "== apply, then an empty rollback restores the exact state"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p6/proposal.sql >/dev/null 2>&1 || { echo "FAIL|apply"; $P -v ON_ERROR_STOP=1 -f docs/hmrc-p6/proposal.sql 2>&1 | grep ERROR | head -3; }
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p6/rollback.sql >/dev/null 2>&1 || echo "FAIL|empty rollback"
same "empty rollback: functions (with grants), tables, audit rule, triggers and policies exactly as before"

echo "== apply again and run the suite (one transaction, rolled back)"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p6/proposal.sql >/dev/null 2>&1 && echo "PASS|re-apply after rollback works" || echo "FAIL|re-apply"
$P -At -c "select case when (select relrowsecurity from pg_class where oid = 'public.hmrc_vat_submissions'::regclass)
  and (select count(*) from pg_trigger where tgrelid = 'public.hmrc_vat_submissions'::regclass and tgname = 'a0_demo_readonly_guard') = 1
  then 'PASS|RLS on, demo guard trigger on the new table' else 'FAIL|rls or demo guard' end"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p6/test.sql 2>&1 | sed -n 's/.*\(PASS|.*\)/\1/p; s/.*\(FAIL|.*\)/\1/p; /ERROR/p'
$P -At -c "select case when (select count(*) from public.hmrc_vat_submissions) = 0 then 'PASS|the suite left no rows behind (rolled back)' else 'FAIL|suite rows left' end"
$P -v ON_ERROR_STOP=1 -f docs/demo-readonly/check-coverage.sql 2>&1 | grep -q 'DEMO_GUARD_OK' && echo "PASS|demo coverage check passes with the new table" || echo "FAIL|demo coverage"

echo "== a second apply is refused; rollback refuses while a submission exists"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p6/proposal.sql 2>&1 | grep -q 'HMRC P6 already exists' && echo "PASS|second apply refused" || echo "FAIL|second apply"
$P -c "INSERT INTO auth.users (id, email) VALUES ('f9000000-0000-4000-8000-0000000000ff', 'r@example.test');
  INSERT INTO public.organizations (id, name) VALUES ('0d900000-0000-4000-8000-000000000001', 'R');
  SELECT * FROM public.hmrc_begin_vat_submission('0d900000-0000-4000-8000-000000000001', 'f9000000-0000-4000-8000-0000000000ff', 'sandbox', '18A1', '2026-01-01', '2026-03-31', '{}', repeat('a', 64), gen_random_uuid(), '789', NULL, 'R')" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p6/rollback.sql 2>&1 | grep -q 'permanent record' && echo "PASS|rollback refused while a submission exists (no force switch)" || echo "FAIL|rollback not refused"
$P -At -c "select case when to_regclass('public.hmrc_vat_submissions') is not null and (select count(*) from public.hmrc_vat_submissions) = 1 then 'PASS|refused rollback changed nothing' else 'FAIL|partial rollback' end"

echo "== drift is refused before anything changes (fresh database)"
$R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1
$R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1; rm -rf $D $S; mkdir -p $D $S; chown "$U" $D $S
$R "$BIN/initdb" -U postgres -D $D >/dev/null 2>&1 && $R "$BIN/pg_ctl" -D $D -o "-p $PORT -k $S -c listen_addresses=''" -l $S/log start >/dev/null && sleep 2

$P -v ON_ERROR_STOP=1 -f scripts/staging/00_supabase_shim.sql >/dev/null 2>&1 || echo "FAIL|shim"
$P -v ON_ERROR_STOP=1 -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;" >/dev/null || echo "FAIL|default privileges"
# Production as of 8 Nov 2026: the earlier fixtures, every applied HMRC and demo proposal, P4, P4b, P4b option B and P5.
for f in docs/phase35/fixture.sql docs/phase36/fixture.sql docs/phase37/fixture.sql docs/phase31/fixture.sql docs/hmrc-p0/fixture.sql \
         docs/hmrc-p0/proposal.sql docs/hmrc-plan/proposal.sql docs/hmrc-p1-p2/proposal.sql docs/hmrc-p3/proposal.sql \
         docs/hmrc-p4/fixture.sql docs/demo-readonly/fixture.sql docs/demo-readonly/proposal.sql docs/hmrc-p4/proposal.sql docs/hmrc-p4b/fixture.sql \
         docs/hmrc-p4b/proposal.sql docs/hmrc-p4b/decision-b-function.sql docs/hmrc-p5/fixture.sql docs/hmrc-p5/proposal.sql docs/hmrc-p6/fixture.sql; do
  $P -v ON_ERROR_STOP=1 -f $f >/dev/null 2>&1 || echo "FAIL|$f"
done

$P -c "ALTER TABLE public.hmrc_audit_log DROP CONSTRAINT hal_event; ALTER TABLE public.hmrc_audit_log ADD CONSTRAINT hal_event CHECK (event IN ('connect_started'))" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p6/proposal.sql 2>&1 | grep -q 'event rule differs' && echo "PASS|a changed audit event rule is refused" || echo "FAIL|audit drift"
$P -c "CREATE OR REPLACE FUNCTION public.hmrc_manage_allowed(p_company uuid, p_user uuid) RETURNS text LANGUAGE sql STABLE SET search_path TO '' AS \$\$ SELECT 'ok'::text \$\$" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p6/proposal.sql 2>&1 | grep -q 'hmrc_manage_allowed.*differs' && echo "PASS|a changed plan/role rule is refused" || echo "FAIL|function drift"
$P -c "CREATE TABLE public.zz_surprise (id int)" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p6/proposal.sql 2>&1 | grep -q 'tables in public differ' && echo "PASS|a changed table set is refused" || echo "FAIL|table drift"
$P -At -c "select case when to_regclass('public.hmrc_vat_submissions') is null then 'PASS|nothing applied after the refusals' else 'FAIL|partial apply' end"
$R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1
