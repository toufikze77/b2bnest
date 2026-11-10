#!/usr/bin/env bash
# HMRC hide switch tests on a DISPOSABLE local Postgres (port 55412, unix socket only). Never touches production.
# From the repo root:   PG_RUN_USER=postgres bash docs/hmrc-hide/run-test.sh
set -u
D=/tmp/hhidepg; S=/tmp/hhidesock; PORT=55412; U=${PG_RUN_USER:-postgres}
R="setpriv --reuid=$U --regid=$(id -gn "$U") --clear-groups"
BIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
P="psql -h $S -p $PORT -U postgres -q -X"

fresh() {
  $R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1; rm -rf $D $S; mkdir -p $D $S; chown "$U" $D $S
  $R "$BIN/initdb" -U postgres -D $D >/dev/null 2>&1 && $R "$BIN/pg_ctl" -D $D -o "-p $PORT -k $S -c listen_addresses=''" -l $S/log start >/dev/null && sleep 2
  $P -v ON_ERROR_STOP=1 -f scripts/staging/00_supabase_shim.sql >/dev/null 2>&1 || echo "FAIL|shim"
  $P -v ON_ERROR_STOP=1 -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;" >/dev/null || echo "FAIL|default privileges"
  # Production as of 8 Nov 2026: the earlier fixtures and every applied proposal up to HMRC P7b (HMRC P8 is not applied).
  for f in docs/phase35/fixture.sql docs/phase36/fixture.sql docs/phase37/fixture.sql docs/phase31/fixture.sql docs/hmrc-p0/fixture.sql \
           docs/hmrc-p0/proposal.sql docs/hmrc-plan/proposal.sql docs/hmrc-p1-p2/proposal.sql docs/hmrc-p3/proposal.sql \
           docs/hmrc-p4/fixture.sql docs/demo-readonly/fixture.sql docs/demo-readonly/proposal.sql docs/hmrc-p4/proposal.sql docs/hmrc-p4b/fixture.sql \
           docs/hmrc-p4b/proposal.sql docs/hmrc-p4b/decision-b-function.sql docs/hmrc-p5/fixture.sql docs/hmrc-p5/proposal.sql docs/hmrc-p6/fixture.sql \
           docs/hmrc-p6/proposal.sql docs/hmrc-p7b/fixture.sql docs/hmrc-p7b/proposal.sql docs/hmrc-p7d/fixture.sql docs/hmrc-hide/fixture.sql; do
    $P -v ON_ERROR_STOP=1 -f $f >/dev/null 2>&1 || echo "FAIL|$f"
  done
}
fresh

echo "== production shape (9 Nov 2026)"
$P -At -c "select case when md5(string_agg(relname, ',' order by relname)) = 'ca2f5c858ee858f9b3f7c14131e00b9f' and count(*) = 148
  then 'PASS|the 148 tables in public = production' else 'FAIL|table set' end from pg_class where relnamespace = 'public'::regnamespace and relkind in ('r','p')"
$P -At -c "select case when string_agg(p.proname || '=' || md5(p.prosrc), ' ' order by p.proname) = 'admin_log_action=92a000fe89ec220db8f85aff178f378c is_super_admin=246e360cf6b2ed74a7ff7c96cbbf2351 require_aal2_admin=25c85041df1954badee597040374a6fd'
  then 'PASS|the functions the switch relies on = production' else 'FAIL|function sources: ' || string_agg(p.proname || '=' || md5(p.prosrc), ' ' order by p.proname) end
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('admin_log_action', 'is_super_admin', 'require_aal2_admin')"
$P -At -c "select case when string_agg(policyname, ',' order by policyname) = 'require_aal2_if_enrolled,super admins insert settings,super admins read settings,super admins update settings'
  then 'PASS|platform_settings policies = production' else 'FAIL|policies' end from pg_policies where tablename = 'platform_settings'"

$P -v ON_ERROR_STOP=1 >/dev/null <<'SQL' || echo "FAIL|fingerprint"
CREATE SCHEMA th;
CREATE FUNCTION th.fingerprint() RETURNS text LANGUAGE sql AS $f$
  SELECT md5(concat_ws('|',
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT p.oid::regprocedure::text || ':' || md5(p.prosrc) || ':' || p.prosecdef::text || ':' ||
        coalesce((SELECT string_agg(x, ',' ORDER BY x) FROM unnest(p.proacl::text[]) x), '') AS v FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace) s),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT c.relname || '.' || a.attname || ':' || format_type(a.atttypid, a.atttypmod) || ':' || a.attnotnull::text AS v
       FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r') s),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT conrelid::regclass::text || '.' || conname || ':' || pg_get_constraintdef(oid) AS v FROM pg_constraint
      WHERE connamespace = 'public'::regnamespace) s),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT indexrelid::regclass::text AS v FROM pg_index i JOIN pg_class c ON c.oid = i.indrelid WHERE c.relnamespace = 'public'::regnamespace) s),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT t.tgrelid::regclass::text || '.' || t.tgname || ':' || t.tgfoid::regproc::text AS v FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
      WHERE c.relnamespace = 'public'::regnamespace AND NOT t.tgisinternal) s),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT c.relname || ':' || coalesce(c.relacl::text, '') || ':' || c.relrowsecurity::text AS v FROM pg_class c
      WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r') s),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT tablename || '.' || policyname || ':' || permissive || ':' || roles::text || ':' || cmd || ':' || coalesce(qual, '') || ':' || coalesce(with_check, '') AS v
      FROM pg_policies WHERE schemaname = 'public') s)))
$f$;
CREATE TABLE th.before AS SELECT th.fingerprint() AS fp;
GRANT USAGE ON SCHEMA th TO PUBLIC;
SQL
same() { $P -At -c "select case when th.fingerprint() = (select fp from th.before) then 'PASS|$1' else 'FAIL|$1' end"; }


echo "== apply, then the rollback restores the exact state"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-hide/proposal.sql >/dev/null 2>&1 || { echo "FAIL|apply"; $P -v ON_ERROR_STOP=1 -f docs/hmrc-hide/proposal.sql 2>&1 | grep ERROR | head -3; }
$P -v ON_ERROR_STOP=1 -f docs/hmrc-hide/rollback.sql >/dev/null 2>&1 || { echo "FAIL|rollback"; $P -v ON_ERROR_STOP=1 -f docs/hmrc-hide/rollback.sql 2>&1 | grep ERROR | head -3; }
same "rollback: functions (with grants), columns, constraints, indexes, triggers, grants, RLS and policies exactly as before"
$P -At -c "select case when not exists (select 1 from public.platform_settings where key = 'hmrc_customer_access') and (select count(*) from public.platform_settings) = 3 then 'PASS|rollback: the row is gone, the other settings stay' else 'FAIL|rollback rows' end"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-hide/rollback.sql 2>&1 | grep -q 'is not applied' && echo "PASS|rollback refused when not applied" || echo "FAIL|rollback twice"

echo "== apply again and run the suite (one transaction, rolled back)"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-hide/proposal.sql >/dev/null 2>&1 && echo "PASS|re-apply after rollback works" || echo "FAIL|re-apply"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-hide/test.sql 2>&1 | sed -n 's/.*\(PASS|.*\)/\1/p; s/.*\(FAIL|.*\)/\1/p; /ERROR/p'
$P -At -c "select case when (select value from public.platform_settings where key = 'hmrc_customer_access') = '\"hidden\"'::jsonb then 'PASS|the suite left the switch hidden (rolled back)' else 'FAIL|suite left a change' end"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-hide/proposal.sql 2>&1 | grep -q 'already exists' && echo "PASS|second apply refused" || echo "FAIL|second apply"
$P -v ON_ERROR_STOP=1 -f docs/demo-readonly/check-coverage.sql 2>&1 | grep -q 'DEMO_GUARD_OK' && echo "PASS|demo coverage check still passes" || echo "FAIL|demo coverage"

echo "== drift is refused before anything changes (fresh database)"
fresh
$P -c "CREATE POLICY zz_extra ON public.platform_settings FOR SELECT TO anon USING (true)" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/hmrc-hide/proposal.sql 2>&1 | grep -q 'policies differ' && echo "PASS|a changed policy set is refused" || echo "FAIL|policy drift"
$P -c "DROP POLICY zz_extra ON public.platform_settings; INSERT INTO public.platform_settings (key, value) VALUES ('hmrc_customer_access', '\"visible\"')" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/hmrc-hide/proposal.sql 2>&1 | grep -q 'already exists' && echo "PASS|an existing hmrc_customer_access row is never overwritten" || echo "FAIL|existing row"
$P -c "DELETE FROM public.platform_settings WHERE key = 'hmrc_customer_access'" >/dev/null
$P -c "CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS 'SELECT true'" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/hmrc-hide/proposal.sql 2>&1 | grep -q 'is_super_admin.*differs' && echo "PASS|a changed is_super_admin is refused" || echo "FAIL|function drift"
$P -c "CREATE TABLE public.zz_surprise (id int)" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/hmrc-hide/proposal.sql 2>&1 | grep -q 'tables in public differ' && echo "PASS|a changed table set is refused" || echo "FAIL|table drift"
$P -At -c "select case when to_regprocedure('public.hmrc_set_customer_access(text)') is null then 'PASS|nothing applied after the refusals' else 'FAIL|partial apply' end"
$R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1
