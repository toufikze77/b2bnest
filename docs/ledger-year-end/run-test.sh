#!/usr/bin/env bash
# Finance phase 5 (financial year end) tests on a DISPOSABLE local Postgres (port 55419, unix socket
# only). Never touches production. From the repo root:   PG_RUN_USER=postgres bash docs/ledger-year-end/run-test.sh
set -u
D=/tmp/hlyepg; S=/tmp/hlyesock; PORT=55419; U=${PG_RUN_USER:-postgres}
R="setpriv --reuid=$U --regid=$(id -gn "$U") --clear-groups"
BIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
P="psql -h $S -p $PORT -U postgres -q -X"

fresh() {
  $R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1; rm -rf $D $S; mkdir -p $D $S; chown "$U" $D $S
  $R "$BIN/initdb" -U postgres -D $D >/dev/null 2>&1 && $R "$BIN/pg_ctl" -D $D -o "-p $PORT -k $S -c listen_addresses=''" -l $S/log start >/dev/null && sleep 2
  $P -v ON_ERROR_STOP=1 -f scripts/staging/00_supabase_shim.sql >/dev/null 2>&1 || echo "FAIL|shim"
  $P -v ON_ERROR_STOP=1 -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;" >/dev/null || echo "FAIL|default privileges"
  # Production as of 22 Nov 2026: the phase 3b chain (docs/ledger-auto-bills/run-test.sh) plus phase 3b, its two
  # follow-ups (#103 category map, #104 VAT registered) phase 3c-1 (docs/ledger-bank), phase 4 (docs/ledger-reports) and 3c-2 (docs/ledger-bank-post), applied.
  for f in docs/phase35/fixture.sql docs/phase36/fixture.sql docs/phase37/fixture.sql docs/phase31/fixture.sql docs/hmrc-p0/fixture.sql \
           docs/hmrc-p0/proposal.sql docs/hmrc-plan/proposal.sql docs/hmrc-p1-p2/proposal.sql docs/hmrc-p3/proposal.sql \
           docs/hmrc-p4/fixture.sql docs/demo-readonly/fixture.sql docs/demo-readonly/proposal.sql docs/hmrc-p4/proposal.sql docs/hmrc-p4b/fixture.sql \
           docs/hmrc-p4b/proposal.sql docs/hmrc-p4b/decision-b-function.sql docs/hmrc-p5/fixture.sql docs/hmrc-p5/proposal.sql docs/hmrc-p6/fixture.sql \
           docs/hmrc-p6/proposal.sql docs/hmrc-p7b/fixture.sql docs/hmrc-p7b/proposal.sql docs/hmrc-p7d/fixture.sql docs/ledger/fixture.sql \
           docs/ledger/proposal.sql docs/ledger-auto/fixture.sql docs/ledger-auto/proposal.sql docs/ledger-auto-bills/fixture.sql \
           docs/ledger-auto-bills/proposal.sql docs/ledger-auto-bills/followup-categories.sql docs/ledger-auto-bills/vat-registered.sql docs/ledger-bank/fixture.sql \
           docs/ledger-bank/proposal.sql docs/ledger-reports/fixture.sql \
           docs/ledger-reports/proposal.sql docs/ledger-bank-post/fixture.sql \
           docs/ledger-bank-post/proposal.sql docs/ledger-year-end/fixture.sql; do
    $P -v ON_ERROR_STOP=1 -f $f >/dev/null 2>&1 || echo "FAIL|$f"
  done
}
fresh
[ "${1:-}" = "--base-only" ] && exit 0
echo "== production shape (22 Nov 2026: phases 2, 3a, 3b with its follow-ups, 3c-1, 4 and 3c-2 applied)"
$P -At -c "select case when md5(string_agg(relname, ',' order by relname)) = 'b9fec97b9d0d8c836c6af78125e92371' and count(*) = 160
  then 'PASS|the 160 tables in public = production' else 'FAIL|table set' end from pg_class where relnamespace = 'public'::regnamespace and relkind in ('r','p')"

$P -v ON_ERROR_STOP=1 >/dev/null <<'SQL' || echo "FAIL|fingerprint"
CREATE SCHEMA tl;
CREATE FUNCTION tl.fingerprint() RETURNS text LANGUAGE sql AS $f$
  SELECT md5(concat_ws('|',
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT p.oid::regprocedure::text || ':' || md5(p.prosrc) || ':' || p.prosecdef::text || ':' ||
        coalesce((SELECT string_agg(x, ',' ORDER BY x) FROM unnest(p.proacl::text[]) x), '') AS v FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace) s),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT c.relname || '.' || a.attname || ':' || format_type(a.atttypid, a.atttypmod) || ':' || a.attnotnull::text AS v
       FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r') s),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT conrelid::regclass::text || '.' || conname || ':' || pg_get_constraintdef(oid) AS v FROM pg_constraint
      WHERE connamespace = 'public'::regnamespace) s),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT indexrelid::regclass::text AS v FROM pg_index i JOIN pg_class c ON c.oid = i.indrelid WHERE c.relnamespace = 'public'::regnamespace) s),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT t.tgrelid::regclass::text || '.' || t.tgname || ':' || t.tgfoid::regproc::text || ':' || t.tgtype::text AS v FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
      WHERE c.relnamespace = 'public'::regnamespace AND NOT t.tgisinternal) s),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT c.relname || ':' || coalesce(c.relacl::text, '') || ':' || c.relrowsecurity::text AS v FROM pg_class c
      WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r') s),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT tablename || '.' || policyname || ':' || permissive || ':' || roles::text || ':' || cmd || ':' || coalesce(qual, '') || ':' || coalesce(with_check, '') AS v
      FROM pg_policies WHERE schemaname = 'public') s)))
$f$;
CREATE TABLE tl.before AS SELECT tl.fingerprint() AS fp;
GRANT USAGE ON SCHEMA tl TO PUBLIC;
SQL
same() { $P -At -c "select case when tl.fingerprint() = (select fp from tl.before) then 'PASS|$1' else 'FAIL|$1' end"; }
# What phase 5 may change: the two replaced functions (_ledger_settings_guard, ledger_report_profit_loss), the new
# functions and trigger, je_source_type, ls_year_end and the two new ledger_settings columns. Everything else must be identical.
NEW="'ledger_year_end_status', 'ledger_year_end_set', 'ledger_year_end_preview', 'ledger_year_end_close', 'ledger_year_end_reopen', '_ledger_ye_date', '_ledger_ye_first', '_ledger_ye_next', '_ledger_ye_lines', '_ledger_ye_warnings', '_ledger_year_end_entry_guard'"
others() { $P -At -c "select md5(concat_ws('|',
  (select string_agg(v, ',' order by v) from (select p.oid::regprocedure::text || md5(p.prosrc) || coalesce(p.proacl::text, '') as v from pg_proc p where p.pronamespace = 'public'::regnamespace
     and p.proname not in ('_ledger_settings_guard', 'ledger_report_profit_loss', $NEW)) s),
  (select string_agg(v, ',' order by v) from (select conrelid::regclass::text || conname || pg_get_constraintdef(oid) as v from pg_constraint where connamespace = 'public'::regnamespace
     and conname not in ('je_source_type', 'ls_year_end')) s),
  (select string_agg(v, ',' order by v) from (select c.relname || '.' || a.attname || ':' || format_type(a.atttypid, a.atttypmod) as v from pg_class c join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
     where c.relnamespace = 'public'::regnamespace and not (c.relname = 'ledger_settings' and a.attname like 'financial_year_end_%')) s),
  (select string_agg(v, ',' order by v) from (select tgrelid::regclass::text || tgname || tgfoid::regproc::text || tgtype::text as v from pg_trigger t join pg_class c on c.oid = t.tgrelid
     where c.relnamespace = 'public'::regnamespace and not tgisinternal and tgname <> 'ledger_year_end_guard') s),
  (select string_agg(v, ',' order by v) from (select tablename || policyname || coalesce(qual, '') || coalesce(with_check, '') as v from pg_policies where schemaname = 'public') s),
  (select string_agg(v, ',' order by v) from (select relname || coalesce(relacl::text, '') || relrowsecurity::text as v from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r') s)))"; }
o1=$(others)
acl() { $P -At -c "select string_agg(proname || coalesce(proacl::text, '') || prosecdef::text || coalesce(proconfig::text, ''), ',' order by proname) from pg_proc where proname in ('_ledger_settings_guard', 'ledger_report_profit_loss')"; }
a1=$(acl)
bstb() { $P -At -c "select string_agg(proname || md5(prosrc) || coalesce(proacl::text, ''), ',' order by proname) from pg_proc where proname in ('ledger_report_balance_sheet', 'ledger_trial_balance')"; }
b1=$(bstb)

# docs/ledger-auto-bills/test.sql was written before its own follow-ups (#103 category map, #104 VAT registered) and
# already stops at its "four bills to post" check on this base chain, without phase 5. Phase 5 must not change its output.
ab() { $P -v ON_ERROR_STOP=1 -f docs/ledger-auto-bills/test.sql 2>&1 | sed -n 's/.*\(PASS|.*\)/\1/p; s/.*\(FAIL|.*\)/\1/p; /ERROR/p' | md5sum; }
ab1=$(ab)
echo "== apply, then an empty rollback restores the exact state"
$P -v ON_ERROR_STOP=1 -f docs/ledger-year-end/proposal.sql >/dev/null 2>&1 || { echo "FAIL|apply"; $P -v ON_ERROR_STOP=1 -f docs/ledger-year-end/proposal.sql 2>&1 | grep ERROR | head -3; }
[ "$(others)" = "$o1" ] && echo "PASS|nothing else changed: other functions, constraints, columns, triggers, policies, table grants and RLS identical" || echo "FAIL|something else changed"
[ "$(acl)" = "$a1" ] && echo "PASS|the two replaced functions kept their grants, security and search_path" || echo "FAIL|grants of replaced functions"
[ "$(bstb)" = "$b1" ] && echo "PASS|the balance sheet and trial balance are not replaced (same bodies and grants)" || echo "FAIL|balance sheet or trial balance changed"
$P -At -c "select case when count(*) = 160 then 'PASS|still 160 tables' else 'FAIL|tables ' || count(*) end from pg_class where relnamespace = 'public'::regnamespace and relkind in ('r','p')"
$P -v ON_ERROR_STOP=1 -f docs/ledger-year-end/rollback.sql >/dev/null 2>&1 || { echo "FAIL|rollback"; $P -v ON_ERROR_STOP=1 -f docs/ledger-year-end/rollback.sql 2>&1 | grep ERROR | head -3; }
same "empty rollback: the phase 2 guard, the phase 4 profit and loss, je_source_type back exactly; the new columns, trigger and functions gone"
$P -v ON_ERROR_STOP=1 -f docs/ledger-year-end/rollback.sql 2>&1 | grep -q 'is not applied' && echo "PASS|rollback refused when not applied" || echo "FAIL|rollback twice"

echo "== apply again and run the suite (one transaction, rolled back)"
$P -v ON_ERROR_STOP=1 -f docs/ledger-year-end/proposal.sql >/dev/null 2>&1 && echo "PASS|re-apply after rollback works" || echo "FAIL|re-apply"
$P -v ON_ERROR_STOP=1 -f docs/ledger-year-end/test.sql 2>&1 | sed -n 's/.*\(PASS|.*\)/\1/p; s/.*\(FAIL|.*\)/\1/p; /ERROR/p'
$P -At -c "select case when (select count(*) from public.journal_entries) = 0 and (select count(*) from public.ledger_settings) = 0
  then 'PASS|the suite left nothing behind (rolled back)' else 'FAIL|suite rows left' end"
echo "== the earlier suites still pass with phase 5 applied"
for t in docs/ledger-bank-post/test.sql docs/ledger-bank/test.sql docs/ledger-reports/test.sql docs/ledger-auto/test.sql docs/ledger/test.sql; do
  out=$($P -v ON_ERROR_STOP=1 -f $t 2>&1); n=$(echo "$out" | grep -cE 'PASS\|'); f=$(echo "$out" | grep -cE 'FAIL\||ERROR')
  [ "$f" = 0 ] && [ "$n" -ge 50 ] && echo "PASS|$t: $n checks pass" || { echo "FAIL|$t ($n pass, $f fail)"; echo "$out" | grep -E 'FAIL\||ERROR' | head -3; }
done
[ "$(ab)" = "$ab1" ] && echo "PASS|docs/ledger-auto-bills/test.sql: output identical to before phase 5 (it predates its own follow-ups)" || echo "FAIL|auto-bills suite output changed"
$P -v ON_ERROR_STOP=1 -f docs/demo-readonly/check-coverage.sql 2>&1 | grep -q 'DEMO_GUARD_OK' && echo "PASS|demo coverage check still passes" || echo "FAIL|demo coverage"
$P -v ON_ERROR_STOP=1 -f docs/ledger-year-end/proposal.sql 2>&1 | grep -q 'already exists' && echo "PASS|second apply refused (already exists)" || echo "FAIL|second apply"

echo "== rollback refuses once a year has been closed (with or without a journal), and after a re-open"
cat > $S/setup.sql <<'SQL'
\set ON_ERROR_STOP 1
INSERT INTO auth.users (id, email) VALUES ('fe510000-0000-4000-8000-000000000001', 'z@example.test');
INSERT INTO public.profiles (id, email, currency_code) VALUES ('fe510000-0000-4000-8000-000000000001', 'z@example.test', 'GBP') ON CONFLICT (id) DO UPDATE SET currency_code = 'GBP';
INSERT INTO public.subscribers (user_id, email, subscribed, subscription_status, plan_key) VALUES ('fe510000-0000-4000-8000-000000000001', 'z@example.test', true, 'active', 'professional');
INSERT INTO public.organizations (id, name, slug, created_by) VALUES ('0fe51000-0000-4000-8000-000000000001', 'Z', 'ye-z', 'fe510000-0000-4000-8000-000000000001');
INSERT INTO public.organization_members (organization_id, user_id, role, is_active) VALUES ('0fe51000-0000-4000-8000-000000000001', 'fe510000-0000-4000-8000-000000000001', 'owner', true);
INSERT INTO public.organization_billing (organization_id, billing_user_id) VALUES ('0fe51000-0000-4000-8000-000000000001', 'fe510000-0000-4000-8000-000000000001');
SELECT set_config('request.jwt.claims', '{"sub": "fe510000-0000-4000-8000-000000000001", "role": "authenticated", "aal": "aal1"}', false);
SET ROLE authenticated;
SELECT public.ledger_setup('0fe51000-0000-4000-8000-000000000001', '2025-01-01', 'fresh', NULL);
SELECT public.ledger_year_end_set('0fe51000-0000-4000-8000-000000000001', 3, 31);
SELECT public.ledger_year_end_close('0fe51000-0000-4000-8000-000000000001', '2025-03-31');
SQL
$P -f $S/setup.sql >/dev/null 2>&1 || echo "FAIL|close setup"
$P -At -c "select case when (select locked_through from public.ledger_settings) = '2025-03-31' and (select count(*) from public.journal_entries) = 0 then 'PASS|a year with no activity closed (committed): lock moved, no journal' else 'FAIL|empty close' end"
$P -v ON_ERROR_STOP=1 -f docs/ledger-year-end/rollback.sql 2>&1 | grep -q 'a year has been closed' && echo "PASS|rollback refused after a close without a journal, and says why" || echo "FAIL|rollback after an empty close"
$P -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL' || echo "FAIL|journal close setup"
SELECT set_config('request.jwt.claims', '{"sub": "fe510000-0000-4000-8000-000000000001", "role": "authenticated", "aal": "aal1"}', false);
SET ROLE authenticated;
SELECT public.ledger_post_journal('0fe51000-0000-4000-8000-000000000001', '2025-05-01', 'Sale', 'a sale', '[{"account_code": "1200", "debit": "10.00"}, {"account_code": "4000", "credit": "10.00"}]'::jsonb);
SELECT public.ledger_year_end_close('0fe51000-0000-4000-8000-000000000001', '2026-03-31');
SELECT public.ledger_year_end_reopen('0fe51000-0000-4000-8000-000000000001', '2026-03-31');
SQL
$P -At -c "select case when (select count(*) from public.journal_entries where source_type = 'year_end') = 1 and (select count(*) from public.journal_entries where source_type = 'reversal') = 1
  and (select locked_through from public.ledger_settings) = '2025-03-31' then 'PASS|a year closed with a journal then re-opened (committed; balanced at commit)' else 'FAIL|journal close' end"
$P -v ON_ERROR_STOP=1 -f docs/ledger-year-end/rollback.sql 2>&1 | grep -q 'year-end journals' && echo "PASS|rollback refused once a year-end journal exists, even re-opened (journals are never deleted)" || echo "FAIL|rollback with a journal"
$P -At -c "select case when to_regprocedure('public.ledger_year_end_close(uuid,date,boolean)') is not null then 'PASS|the refused rollbacks changed nothing' else 'FAIL|partial rollback' end"
$P -At -c "select case when (select count(*) from public.audit_logs where action like 'ledger.year_end%') = 4 then 'PASS|four audit rows: set, close, close, re-open' else 'FAIL|audit rows' end"

echo "== drift is refused before anything changes (fresh database)"
fresh
$P -c "CREATE TABLE public.zz_surprise (id int)" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/ledger-year-end/proposal.sql 2>&1 | grep -q 'tables in public differ' && echo "PASS|a changed table set is refused" || echo "FAIL|table drift"
fresh
$P -c "CREATE OR REPLACE FUNCTION public.ledger_report_balance_sheet(p_org uuid, p_as_of date) RETURNS TABLE(account_id uuid, code text, name text, type text, is_active boolean, balance numeric, balanced boolean) LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS 'SELECT NULL::uuid, NULL, NULL, NULL, NULL::boolean, NULL::numeric, NULL::boolean WHERE false'" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/ledger-year-end/proposal.sql 2>&1 | grep -q 'ledger_report_balance_sheet.*differs' && echo "PASS|a changed balance sheet (relied on, not replaced) is refused" || echo "FAIL|function drift"
fresh
$P -c "CREATE OR REPLACE FUNCTION public._ledger_settings_guard() RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS 'BEGIN RETURN NEW; END'" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/ledger-year-end/proposal.sql 2>&1 | grep -q '_ledger_settings_guard.*differs' && echo "PASS|a changed lock guard is refused" || echo "FAIL|guard drift"
fresh
$P -c "ALTER TABLE public.journal_entries DROP CONSTRAINT je_source_type; ALTER TABLE public.journal_entries ADD CONSTRAINT je_source_type CHECK (source_type IN ('manual', 'reversal'))" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/ledger-year-end/proposal.sql 2>&1 | grep -q 'je_source_type differs' && echo "PASS|a changed constraint is refused" || echo "FAIL|constraint drift"
fresh
$P -c "ALTER TABLE public.ledger_settings ADD COLUMN notes text" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/ledger-year-end/proposal.sql 2>&1 | grep -q 'ledger_settings columns differ' && echo "PASS|a changed ledger_settings is refused" || echo "FAIL|column drift"
$P -At -c "select case when to_regprocedure('public.ledger_year_end_close(uuid,date,boolean)') is null then 'PASS|nothing was applied by the refused runs' else 'FAIL|partial apply' end"
$R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1
