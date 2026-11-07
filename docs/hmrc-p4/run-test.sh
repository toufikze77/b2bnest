#!/usr/bin/env bash
# HMRC P4 tests on a DISPOSABLE local Postgres (port 55405, unix socket only). Never touches production.
# From the repo root:   PG_RUN_USER=postgres bash docs/hmrc-p4/run-test.sh
set -u
D=/tmp/hp4pg; S=/tmp/hp4sock; PORT=55405; U=${PG_RUN_USER:-postgres}
R="setpriv --reuid=$U --regid=$(id -gn "$U") --clear-groups"
BIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
P="psql -h $S -p $PORT -U postgres -q -X"
$R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1; rm -rf $D $S; mkdir -p $D $S; chown "$U" $D $S
$R "$BIN/initdb" -U postgres -D $D >/dev/null 2>&1 && $R "$BIN/pg_ctl" -D $D -o "-p $PORT -k $S -c listen_addresses=''" -l $S/log start >/dev/null && sleep 2

$P -v ON_ERROR_STOP=1 -f scripts/staging/00_supabase_shim.sql >/dev/null 2>&1 || echo "FAIL|shim"
$P -v ON_ERROR_STOP=1 -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;" >/dev/null || echo "FAIL|default privileges"
# Production as of 7 Nov 2026: the earlier fixtures and every applied HMRC and demo proposal.
for f in docs/phase35/fixture.sql docs/phase36/fixture.sql docs/phase37/fixture.sql docs/phase31/fixture.sql docs/hmrc-p0/fixture.sql \
         docs/hmrc-p0/proposal.sql docs/hmrc-plan/proposal.sql docs/hmrc-p1-p2/proposal.sql docs/hmrc-p3/proposal.sql \
         docs/hmrc-p4/fixture.sql docs/demo-readonly/fixture.sql docs/demo-readonly/proposal.sql; do
  $P -v ON_ERROR_STOP=1 -f $f >/dev/null 2>&1 || echo "FAIL|$f"
done

echo "== production shape (7 Nov 2026)"
$P -At -c "select case when md5(string_agg(relname, ',' order by relname)) = 'e99e2727c1ab5149215da05dea609062' and count(*) = 146
  then 'PASS|the 146 tables in public = production' else 'FAIL|table set' end from pg_class where relnamespace = 'public'::regnamespace and relkind in ('r','p')"
$P -At -c "select case when string_agg(c.relname || '=' || (select md5(string_agg(a.attname || ':' || format_type(a.atttypid, a.atttypmod) || ':' || coalesce(pg_get_expr(d.adbin, d.adrelid), '') || ':' || a.attnotnull::text, ',' order by a.attnum))
    from pg_attribute a left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped), ' ' order by c.relname)
  = 'bills=40d858b9fe7f9b39af7f0bcd4933248b expenses=2b4cb452066a866d220cd8929c4a4d71 invoices=cb44a4bc14a5d689fc380a4d0587849e'
  then 'PASS|invoices, expenses and bills columns = production' else 'FAIL|column signatures' end from pg_class c where c.oid in ('public.invoices'::regclass, 'public.expenses'::regclass, 'public.bills'::regclass)"

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
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT t.tgrelid::regclass::text || '.' || t.tgname AS v FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
      WHERE c.relnamespace = 'public'::regnamespace AND NOT t.tgisinternal) s),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT tablename || '.' || policyname || ':' || cmd || ':' || coalesce(qual, '') || ':' || coalesce(with_check, '') AS v FROM pg_policies WHERE schemaname = 'public') s)))
$f$;
CREATE TABLE t2.before AS SELECT t2.fingerprint() AS fp;
GRANT USAGE ON SCHEMA t2 TO PUBLIC;
SQL

echo "== apply, then an empty rollback restores the exact state"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p4/proposal.sql >/dev/null 2>&1 || { echo "FAIL|apply"; $P -v ON_ERROR_STOP=1 -f docs/hmrc-p4/proposal.sql 2>&1 | grep ERROR | head -3; }
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p4/rollback.sql >/dev/null 2>&1 || echo "FAIL|empty rollback"
$P -At -c "select case when t2.fingerprint() = (select fp from t2.before) then 'PASS|empty rollback: functions, columns, constraints, triggers and policies exactly as before' else 'FAIL|empty rollback not exact' end"

echo "== apply again and run the suite (one transaction, rolled back)"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p4/proposal.sql >/dev/null 2>&1 && echo "PASS|re-apply after rollback works" || echo "FAIL|re-apply"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p4/test.sql 2>&1 | sed -n 's/.*\(PASS|.*\)/\1/p; s/.*\(FAIL|.*\)/\1/p; /ERROR/p'
$P -At -c "select case when (select count(*) from public.invoices) = 0 then 'PASS|the suite left no rows behind (rolled back)' else 'FAIL|suite rows left' end"
$P -v ON_ERROR_STOP=1 -f docs/demo-readonly/check-coverage.sql 2>&1 | grep -q 'DEMO_GUARD_OK' && echo "PASS|demo coverage check still passes (no new table)" || echo "FAIL|demo coverage"

echo "== a second apply is refused"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p4/proposal.sql 2>&1 | grep -q 'HMRC P4 already exists' && echo "PASS|second apply refused" || echo "FAIL|second apply"

echo "== rollback with recorded VAT: refused, then forced (exact)"
$P -c "INSERT INTO auth.users (id, email) VALUES ('f5000000-0000-4000-8000-0000000000ff', 'r@example.test');
  INSERT INTO public.expenses (user_id, category, description, amount, date, net_amount, vat_amount, vat_treatment, vat_rate, vat_status, tax_point_date)
  VALUES ('f5000000-0000-4000-8000-0000000000ff', 'x', 'x', 12, '2026-11-07', 10, 2, 'standard', 20, 'recorded', '2026-11-07')" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p4/rollback.sql 2>&1 | grep -q 'have VAT details recorded' && echo "PASS|rollback refused without force" || echo "FAIL|rollback not refused"
$P -At -c "select case when to_regprocedure('public.vat_records_needing_attention()') is not null then 'PASS|refused rollback changed nothing' else 'FAIL|partial rollback' end"
PGOPTIONS='-c app.hmrc_p4_force=on' $P -v ON_ERROR_STOP=1 -f docs/hmrc-p4/rollback.sql >/dev/null 2>&1 || echo "FAIL|forced rollback"
$P -c "DELETE FROM public.expenses; DELETE FROM auth.users WHERE email = 'r@example.test'" >/dev/null
$P -At -c "select case when t2.fingerprint() = (select fp from t2.before) then 'PASS|forced rollback: columns, checks, trigger and functions removed exactly' else 'FAIL|forced rollback not exact' end"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p4/rollback.sql 2>&1 | grep -q 'not applied' && echo "PASS|rollback when not applied is refused" || echo "FAIL|rollback when not applied"

echo "== drift is refused before anything changes"
$P -c "ALTER TABLE public.expenses ADD COLUMN surprise text" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p4/proposal.sql 2>&1 | grep -q 'public.expenses columns differ' && echo "PASS|a changed expenses table is refused" || echo "FAIL|column drift"
$P -c "ALTER TABLE public.expenses DROP COLUMN surprise" >/dev/null
$P -c "CREATE POLICY extra ON public.invoices FOR SELECT USING (true)" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p4/proposal.sql 2>&1 | grep -q 'policies on invoices, expenses and bills differ' && echo "PASS|a changed policy is refused" || echo "FAIL|policy drift"
$P -c "DROP POLICY extra ON public.invoices" >/dev/null
$P -c "CREATE TRIGGER zz_extra BEFORE UPDATE ON public.bills FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at()" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p4/proposal.sql 2>&1 | grep -q 'triggers on invoices, expenses and bills differ' && echo "PASS|a changed trigger set is refused" || echo "FAIL|trigger drift"
$P -At -c "select case when to_regprocedure('public.vat_records_needing_attention()') is null and not exists (select 1 from information_schema.columns where table_name = 'invoices' and column_name = 'vat_status') then 'PASS|nothing applied after the refusals' else 'FAIL|partial apply' end"

$R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1
