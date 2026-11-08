#!/usr/bin/env bash
# HMRC P5 tests on a DISPOSABLE local Postgres (port 55407, unix socket only). Never touches production.
# From the repo root:   PG_RUN_USER=postgres bash docs/hmrc-p5/run-test.sh
set -u
D=/tmp/hp5pg; S=/tmp/hp5sock; PORT=55407; U=${PG_RUN_USER:-postgres}
R="setpriv --reuid=$U --regid=$(id -gn "$U") --clear-groups"
BIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
P="psql -h $S -p $PORT -U postgres -q -X"
$R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1; rm -rf $D $S; mkdir -p $D $S; chown "$U" $D $S
$R "$BIN/initdb" -U postgres -D $D >/dev/null 2>&1 && $R "$BIN/pg_ctl" -D $D -o "-p $PORT -k $S -c listen_addresses=''" -l $S/log start >/dev/null && sleep 2

$P -v ON_ERROR_STOP=1 -f scripts/staging/00_supabase_shim.sql >/dev/null 2>&1 || echo "FAIL|shim"
$P -v ON_ERROR_STOP=1 -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;" >/dev/null || echo "FAIL|default privileges"
# Production as of 8 Nov 2026: the earlier fixtures, every applied HMRC and demo proposal, P4, P4b and P4b option B.
for f in docs/phase35/fixture.sql docs/phase36/fixture.sql docs/phase37/fixture.sql docs/phase31/fixture.sql docs/hmrc-p0/fixture.sql \
         docs/hmrc-p0/proposal.sql docs/hmrc-plan/proposal.sql docs/hmrc-p1-p2/proposal.sql docs/hmrc-p3/proposal.sql \
         docs/hmrc-p4/fixture.sql docs/demo-readonly/fixture.sql docs/demo-readonly/proposal.sql docs/hmrc-p4/proposal.sql docs/hmrc-p4b/fixture.sql \
         docs/hmrc-p4b/proposal.sql docs/hmrc-p4b/decision-b-function.sql docs/hmrc-p5/fixture.sql; do
  $P -v ON_ERROR_STOP=1 -f $f >/dev/null 2>&1 || echo "FAIL|$f"
done

echo "== production shape (8 Nov 2026, after HMRC P4, P4b and option B)"
$P -At -c "select case when md5(string_agg(relname, ',' order by relname)) = 'e99e2727c1ab5149215da05dea609062' and count(*) = 146
  then 'PASS|the 146 tables in public = production' else 'FAIL|table set' end from pg_class where relnamespace = 'public'::regnamespace and relkind in ('r','p')"
$P -At -c "select case when string_agg(c.relname || '=' || (select md5(string_agg(a.attname || ':' || format_type(a.atttypid, a.atttypmod) || ':' || coalesce(pg_get_expr(d.adbin, d.adrelid), '') || ':' || a.attnotnull::text, ',' order by a.attnum))
    from pg_attribute a left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped), ' ' order by c.relname)
  = 'bills=76a2289e3944ffdfb82380fee4eb8c4a expenses=97783f9a3d884194e1b37f30c9680734 invoices=79eeb7cdeb4efb8c7dab0ae680785010 organization_members=9196ca32cb304ecfdc12de1d4a249001'
  then 'PASS|invoices, expenses, bills and organization_members columns = production' else 'FAIL|column signatures' end
  from pg_class c where c.oid in ('public.invoices'::regclass, 'public.expenses'::regclass, 'public.bills'::regclass, 'public.organization_members'::regclass)"
$P -At -c "select case when string_agg(p.proname || '=' || md5(p.prosrc), ' ' order by p.proname) = 'hmrc_manage_allowed=9304f069f05402aab62d343b3626cd65 mfa_ok=20516f2ec203220b3ac08d1230c7c306 user_is_organization_member=1fb55538d44b2451875f8baf1b6e4388 vat_company_records_summary=67733fe724545b1ea4942835dae47281'
  then 'PASS|the functions P5 relies on = production' else 'FAIL|function sources: ' || string_agg(p.proname || '=' || md5(p.prosrc), ' ' order by p.proname) end
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('hmrc_manage_allowed', 'mfa_ok', 'user_is_organization_member', 'vat_company_records_summary')"

$P -v ON_ERROR_STOP=1 >/dev/null <<'SQL' || echo "FAIL|fingerprint"
CREATE SCHEMA t2;
CREATE FUNCTION t2.fingerprint() RETURNS text LANGUAGE sql AS $f$
  SELECT md5(concat_ws('|',
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT p.oid::regprocedure::text || ':' || md5(p.prosrc) || ':' || p.prosecdef::text || ':' ||
        coalesce((SELECT string_agg(x, ',' ORDER BY x) FROM unnest(p.proacl::text[]) x), '') AS v FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace) s),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT c.relname || '.' || a.attname || ':' || format_type(a.atttypid, a.atttypmod) AS v
       FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r') s),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT t.tgrelid::regclass::text || '.' || t.tgname AS v FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
      WHERE c.relnamespace = 'public'::regnamespace AND NOT t.tgisinternal) s),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT tablename || '.' || policyname || ':' || cmd || ':' || coalesce(qual, '') || ':' || coalesce(with_check, '') AS v FROM pg_policies WHERE schemaname = 'public') s)))
$f$;
CREATE TABLE t2.before AS SELECT t2.fingerprint() AS fp;
GRANT USAGE ON SCHEMA t2 TO PUBLIC;
SQL
same() { $P -At -c "select case when t2.fingerprint() = (select fp from t2.before) then 'PASS|$1' else 'FAIL|$1' end"; }

echo "== apply, then a rollback restores the exact state"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p5/proposal.sql >/dev/null 2>&1 || { echo "FAIL|apply"; $P -v ON_ERROR_STOP=1 -f docs/hmrc-p5/proposal.sql 2>&1 | grep ERROR | head -3; }
$P -At -c "select case when (select prosecdef and array_to_string(proconfig, ',') = 'search_path=\"\"' from pg_proc where oid = 'public.vat_company_return_preview(uuid,date,date)'::regprocedure)
  and not has_function_privilege('anon', 'public.vat_company_return_preview(uuid,date,date)', 'EXECUTE') and has_function_privilege('authenticated', 'public.vat_company_return_preview(uuid,date,date)', 'EXECUTE')
  then 'PASS|SECURITY DEFINER, search_path empty, authenticated only (not anon)' else 'FAIL|definition or grants' end"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p5/rollback.sql >/dev/null 2>&1 || echo "FAIL|rollback"
same "rollback: functions (with grants), columns, triggers and policies exactly as before"

echo "== apply again and run the suite (one transaction, rolled back)"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p5/proposal.sql >/dev/null 2>&1 && echo "PASS|re-apply after rollback works" || echo "FAIL|re-apply"
$P -c "CREATE TABLE t2.applied AS SELECT t2.fingerprint() AS fp" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p5/test.sql 2>&1 | sed -n 's/.*\(PASS|.*\)/\1/p; s/.*\(FAIL|.*\)/\1/p; /ERROR/p'
$P -At -c "select case when (select count(*) from public.invoices) = 0 then 'PASS|the suite left no rows behind (rolled back)' else 'FAIL|suite rows left' end"
$P -At -c "select case when t2.fingerprint() = (select fp from t2.applied) then 'PASS|the preview changed no table, trigger, policy or function' else 'FAIL|something changed' end"
$P -v ON_ERROR_STOP=1 -f docs/demo-readonly/check-coverage.sql 2>&1 | grep -q 'DEMO_GUARD_OK' && echo "PASS|demo coverage check still passes (no new table)" || echo "FAIL|demo coverage"

echo "== a second apply is refused; rollback when not applied is refused"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p5/proposal.sql 2>&1 | grep -q 'HMRC P5 already exists' && echo "PASS|second apply refused" || echo "FAIL|second apply"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p5/rollback.sql >/dev/null 2>&1 || echo "FAIL|rollback"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p5/rollback.sql 2>&1 | grep -q 'not applied' && echo "PASS|rollback when not applied is refused" || echo "FAIL|rollback when not applied"

echo "== drift is refused before anything changes"
$P -c "ALTER TABLE public.invoices ADD COLUMN surprise text" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p5/proposal.sql 2>&1 | grep -q 'public.invoices columns differ' && echo "PASS|a changed invoices table is refused" || echo "FAIL|column drift"
$P -c "ALTER TABLE public.invoices DROP COLUMN surprise" >/dev/null
$P -c "CREATE OR REPLACE FUNCTION public.hmrc_manage_allowed(p_company uuid, p_user uuid) RETURNS text LANGUAGE sql STABLE SET search_path TO '' AS \$\$ SELECT 'ok'::text \$\$" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p5/proposal.sql 2>&1 | grep -q 'hmrc_manage_allowed.*differs' && echo "PASS|a changed plan/role rule is refused" || echo "FAIL|function drift"
$P -At -c "select case when to_regprocedure('public.vat_company_return_preview(uuid,date,date)') is null then 'PASS|nothing applied after the refusals' else 'FAIL|partial apply' end"

$R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1
