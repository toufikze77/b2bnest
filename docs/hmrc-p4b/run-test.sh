#!/usr/bin/env bash
# HMRC P4b tests on a DISPOSABLE local Postgres (port 55406, unix socket only). Never touches production.
# From the repo root:   PG_RUN_USER=postgres bash docs/hmrc-p4b/run-test.sh
set -u
D=/tmp/hp4bpg; S=/tmp/hp4bsock; PORT=55406; U=${PG_RUN_USER:-postgres}
R="setpriv --reuid=$U --regid=$(id -gn "$U") --clear-groups"
BIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
P="psql -h $S -p $PORT -U postgres -q -X"
$R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1; rm -rf $D $S; mkdir -p $D $S; chown "$U" $D $S
$R "$BIN/initdb" -U postgres -D $D >/dev/null 2>&1 && $R "$BIN/pg_ctl" -D $D -o "-p $PORT -k $S -c listen_addresses=''" -l $S/log start >/dev/null && sleep 2

$P -v ON_ERROR_STOP=1 -f scripts/staging/00_supabase_shim.sql >/dev/null 2>&1 || echo "FAIL|shim"
$P -v ON_ERROR_STOP=1 -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;" >/dev/null || echo "FAIL|default privileges"
# Production as of 7 Nov 2026: the earlier fixtures, every applied HMRC and demo proposal, and HMRC P4 (applied).
for f in docs/phase35/fixture.sql docs/phase36/fixture.sql docs/phase37/fixture.sql docs/phase31/fixture.sql docs/hmrc-p0/fixture.sql \
         docs/hmrc-p0/proposal.sql docs/hmrc-plan/proposal.sql docs/hmrc-p1-p2/proposal.sql docs/hmrc-p3/proposal.sql \
         docs/hmrc-p4/fixture.sql docs/demo-readonly/fixture.sql docs/demo-readonly/proposal.sql docs/hmrc-p4/proposal.sql docs/hmrc-p4b/fixture.sql; do
  $P -v ON_ERROR_STOP=1 -f $f >/dev/null 2>&1 || echo "FAIL|$f"
done

echo "== production shape (7 Nov 2026, after HMRC P4)"
$P -At -c "select case when md5(string_agg(relname, ',' order by relname)) = 'e99e2727c1ab5149215da05dea609062' and count(*) = 146
  then 'PASS|the 146 tables in public = production' else 'FAIL|table set' end from pg_class where relnamespace = 'public'::regnamespace and relkind in ('r','p')"
$P -At -c "select case when string_agg(c.relname || '=' || (select md5(string_agg(a.attname || ':' || format_type(a.atttypid, a.atttypmod) || ':' || coalesce(pg_get_expr(d.adbin, d.adrelid), '') || ':' || a.attnotnull::text, ',' order by a.attnum))
    from pg_attribute a left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped), ' ' order by c.relname)
  = 'bills=143f9368d5f8fb372d9ca73cbf8cdac8 expenses=3302704976e5a0a8c87a6bf37648b2df invoices=b9611f63d017a039efcfc0f172d7e700 organization_members=9196ca32cb304ecfdc12de1d4a249001'
  then 'PASS|invoices, expenses, bills and organization_members columns = production' else 'FAIL|column signatures' end
  from pg_class c where c.oid in ('public.invoices'::regclass, 'public.expenses'::regclass, 'public.bills'::regclass, 'public.organization_members'::regclass)"
$P -At -c "select case when string_agg(p.proname || '=' || md5(p.prosrc), ' ' order by p.proname) = 'demo_readonly_guard=087b5fe2695b95b8ba2ba6eb195ba995 user_is_organization_admin=c6dd628541413ec82565a6676a55a767 user_is_organization_member=1fb55538d44b2451875f8baf1b6e4388 vat_check_invoice_lines=27e4db86b0ef6df6bc3c2ca8f9577d4d vat_records_needing_attention=f2bf9dda2c44d67442fe86fa35d98321'
  then 'PASS|the functions P4b uses or replaces = production' else 'FAIL|function sources: ' || string_agg(p.proname || '=' || md5(p.prosrc), ' ' order by p.proname) end
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('demo_readonly_guard', 'user_is_organization_admin', 'user_is_organization_member', 'vat_check_invoice_lines', 'vat_records_needing_attention')"

$P -v ON_ERROR_STOP=1 >/dev/null <<'SQL' || echo "FAIL|fingerprint"
CREATE SCHEMA t2;
CREATE FUNCTION t2.fingerprint() RETURNS text LANGUAGE sql AS $f$
  SELECT md5(concat_ws('|',
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT p.oid::regprocedure::text || ':' || md5(p.prosrc) || ':' || p.prosecdef::text || ':' ||
        coalesce((SELECT string_agg(x, ',' ORDER BY x) FROM unnest(p.proacl::text[]) x), '') AS v FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace) s),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT c.relname || '.' || a.attname || ':' || format_type(a.atttypid, a.atttypmod) || ':' || coalesce(pg_get_expr(d.adbin, d.adrelid), '') || ':' || a.attnotnull::text AS v
       FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
      WHERE c.oid IN ('public.invoices'::regclass, 'public.expenses'::regclass, 'public.bills'::regclass)) s),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT conrelid::regclass::text || '.' || conname || ':' || pg_get_constraintdef(oid) AS v FROM pg_constraint
      WHERE conrelid IN ('public.invoices'::regclass, 'public.expenses'::regclass, 'public.bills'::regclass)) s),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT tablename || '.' || indexname || ':' || indexdef AS v FROM pg_indexes WHERE schemaname = 'public' AND tablename IN ('invoices', 'expenses', 'bills')) s),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT t.tgrelid::regclass::text || '.' || t.tgname AS v FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
      WHERE c.relnamespace = 'public'::regnamespace AND NOT t.tgisinternal) s),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT tablename || '.' || policyname || ':' || cmd || ':' || coalesce(qual, '') || ':' || coalesce(with_check, '') AS v FROM pg_policies WHERE schemaname = 'public') s)))
$f$;
CREATE TABLE t2.before AS SELECT t2.fingerprint() AS fp;
GRANT USAGE ON SCHEMA t2 TO PUBLIC;
SQL
same() { $P -At -c "select case when t2.fingerprint() = (select fp from t2.before) then 'PASS|$1' else 'FAIL|$1' end"; }

echo "== apply, then an empty rollback restores the exact state"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p4b/proposal.sql >/dev/null 2>&1 || { echo "FAIL|apply"; $P -v ON_ERROR_STOP=1 -f docs/hmrc-p4b/proposal.sql 2>&1 | grep ERROR | head -3; }
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p4b/rollback.sql >/dev/null 2>&1 || echo "FAIL|empty rollback"
same "empty rollback: functions (with grants), columns, constraints, indexes, triggers and policies exactly as before"

echo "== apply again and run the suite (one transaction, rolled back)"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p4b/proposal.sql >/dev/null 2>&1 && echo "PASS|re-apply after rollback works" || echo "FAIL|re-apply"
$P -At -c "select case when (select count(*) from pg_policies where schemaname = 'public' and tablename in ('invoices','expenses','bills')) = 12 then 'PASS|no policy added or changed by the proposal' else 'FAIL|policies changed' end"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p4b/test.sql 2>&1 | sed -n 's/.*\(PASS|.*\)/\1/p; s/.*\(FAIL|.*\)/\1/p; /ERROR/p'
$P -At -c "select case when (select count(*) from public.invoices) = 0 then 'PASS|the suite left no rows behind (rolled back)' else 'FAIL|suite rows left' end"
$P -v ON_ERROR_STOP=1 -f docs/demo-readonly/check-coverage.sql 2>&1 | grep -q 'DEMO_GUARD_OK' && echo "PASS|demo coverage check still passes (no new table)" || echo "FAIL|demo coverage"

echo "== owner decision, option A (read policy): apply, test, roll back exactly"
$P -c "CREATE TABLE t2.p4b AS SELECT t2.fingerprint() AS fp" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p4b/decision-a-policy.sql >/dev/null 2>&1 || echo "FAIL|apply option A"
$P -v ON_ERROR_STOP=1 -v option_a=1 -f docs/hmrc-p4b/decision-test.sql 2>&1 | sed -n 's/.*\(PASS|.*\)/\1/p; s/.*\(FAIL|.*\)/\1/p; /ERROR/p'
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p4b/decision-b-function.sql 2>&1 | grep -q 'option A is applied' && echo "PASS|option B is refused while option A is applied" || echo "FAIL|both options"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p4b/rollback.sql 2>&1 | grep -q 'owner-decision file is applied' && echo "PASS|the P4b rollback refuses while a decision is applied" || echo "FAIL|rollback with decision"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p4b/decision-a-rollback.sql >/dev/null 2>&1 || echo "FAIL|roll back option A"
$P -At -c "select case when t2.fingerprint() = (select fp from t2.p4b) then 'PASS|option A rolled back exactly' else 'FAIL|option A rollback not exact' end"

echo "== owner decision, option B (summary function): apply, test, roll back exactly"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p4b/decision-b-function.sql >/dev/null 2>&1 || { echo "FAIL|apply option B"; $P -v ON_ERROR_STOP=1 -f docs/hmrc-p4b/decision-b-function.sql 2>&1 | grep ERROR | head -3; }
$P -At -c "select case when (select prosecdef and array_to_string(proconfig, ',') = 'search_path=\"\"' from pg_proc where oid = 'public.vat_company_records_summary(uuid,date,date)'::regprocedure)
  and not has_function_privilege('anon', 'public.vat_company_records_summary(uuid,date,date)', 'EXECUTE') then 'PASS|option B: SECURITY DEFINER, search_path empty, not for anon' else 'FAIL|option B definition' end"
$P -v ON_ERROR_STOP=1 -v option_b=1 -f docs/hmrc-p4b/decision-test.sql 2>&1 | sed -n 's/.*\(PASS|.*\)/\1/p; s/.*\(FAIL|.*\)/\1/p; /ERROR/p'
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p4b/decision-b-rollback.sql >/dev/null 2>&1 || echo "FAIL|roll back option B"
$P -At -c "select case when t2.fingerprint() = (select fp from t2.p4b) then 'PASS|option B rolled back exactly' else 'FAIL|option B rollback not exact' end"

echo "== a second apply is refused"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p4b/proposal.sql 2>&1 | grep -q 'HMRC P4b already exists' && echo "PASS|second apply refused" || echo "FAIL|second apply"

echo "== rollback with linked records: refused, then forced (exact)"
$P -c "INSERT INTO auth.users (id, email) VALUES ('f6000000-0000-4000-8000-0000000000ff', 'r@example.test');
  INSERT INTO public.organizations (id, name) VALUES ('0c600000-0000-4000-8000-000000000001', 'R');
  INSERT INTO public.expenses (user_id, category, description, amount, date, organization_id) VALUES ('f6000000-0000-4000-8000-0000000000ff', 'x', 'x', 12, '2026-11-07', '0c600000-0000-4000-8000-000000000001')" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p4b/rollback.sql 2>&1 | grep -q 'linked to a company' && echo "PASS|rollback refused without force" || echo "FAIL|rollback not refused"
$P -At -c "select case when to_regprocedure('public.finance_company_check()') is not null then 'PASS|refused rollback changed nothing' else 'FAIL|partial rollback' end"
$P -c "DELETE FROM public.organizations WHERE id = '0c600000-0000-4000-8000-000000000001'" 2>&1 | grep -q 'violates foreign key' && echo "PASS|a company with finance records cannot be deleted (ON DELETE RESTRICT)" || echo "FAIL|company delete"
PGOPTIONS='-c app.hmrc_p4b_force=on' $P -v ON_ERROR_STOP=1 -f docs/hmrc-p4b/rollback.sql >/dev/null 2>&1 || echo "FAIL|forced rollback"
$P -c "DELETE FROM public.expenses; DELETE FROM public.organizations WHERE id = '0c600000-0000-4000-8000-000000000001'; DELETE FROM auth.users WHERE email = 'r@example.test'" >/dev/null
same "forced rollback: column, index, trigger and functions removed; the P4 attention function restored exactly"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p4b/rollback.sql 2>&1 | grep -q 'not applied' && echo "PASS|rollback when not applied is refused" || echo "FAIL|rollback when not applied"

echo "== drift is refused before anything changes"
$P -c "ALTER TABLE public.bills ADD COLUMN surprise text" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p4b/proposal.sql 2>&1 | grep -q 'public.bills columns differ' && echo "PASS|a changed bills table is refused" || echo "FAIL|column drift"
$P -c "ALTER TABLE public.bills DROP COLUMN surprise" >/dev/null
$P -c "CREATE POLICY extra ON public.expenses FOR SELECT USING (true)" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p4b/proposal.sql 2>&1 | grep -q 'policies on invoices, expenses and bills differ' && echo "PASS|a changed policy is refused" || echo "FAIL|policy drift"
$P -c "DROP POLICY extra ON public.expenses" >/dev/null
$P -c "CREATE OR REPLACE FUNCTION public.user_is_organization_member(org_id uuid, check_user_id uuid DEFAULT auth.uid()) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS 'SELECT true'" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p4b/proposal.sql 2>&1 | grep -q 'differs from production' && echo "PASS|a changed membership check is refused" || echo "FAIL|function drift"
$P -At -c "select case when to_regprocedure('public.finance_company_check()') is null and not exists (select 1 from information_schema.columns where table_name = 'expenses' and column_name = 'organization_id') then 'PASS|nothing applied after the refusals' else 'FAIL|partial apply' end"

$R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1
