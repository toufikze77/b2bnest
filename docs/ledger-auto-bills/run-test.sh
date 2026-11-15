#!/usr/bin/env bash
# Finance phase 3b (automatic bill and expense postings) tests on a DISPOSABLE local Postgres (port 55415, unix socket only).
# Never touches production. From the repo root:   PG_RUN_USER=postgres bash docs/ledger-auto-bills/run-test.sh
set -u
D=/tmp/hlbillpg; S=/tmp/hlbillsock; PORT=55415; U=${PG_RUN_USER:-postgres}
R="setpriv --reuid=$U --regid=$(id -gn "$U") --clear-groups"
BIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
P="psql -h $S -p $PORT -U postgres -q -X"

fresh() {
  $R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1; rm -rf $D $S; mkdir -p $D $S; chown "$U" $D $S
  $R "$BIN/initdb" -U postgres -D $D >/dev/null 2>&1 && $R "$BIN/pg_ctl" -D $D -o "-p $PORT -k $S -c listen_addresses=''" -l $S/log start >/dev/null && sleep 2
  $P -v ON_ERROR_STOP=1 -f scripts/staging/00_supabase_shim.sql >/dev/null 2>&1 || echo "FAIL|shim"
  $P -v ON_ERROR_STOP=1 -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;" >/dev/null || echo "FAIL|default privileges"
  # Production as of 14 Nov 2026: the phase 3a chain (docs/ledger-auto/run-test.sh) plus docs/ledger-auto/proposal.sql, applied.
  for f in docs/phase35/fixture.sql docs/phase36/fixture.sql docs/phase37/fixture.sql docs/phase31/fixture.sql docs/hmrc-p0/fixture.sql \
           docs/hmrc-p0/proposal.sql docs/hmrc-plan/proposal.sql docs/hmrc-p1-p2/proposal.sql docs/hmrc-p3/proposal.sql \
           docs/hmrc-p4/fixture.sql docs/demo-readonly/fixture.sql docs/demo-readonly/proposal.sql docs/hmrc-p4/proposal.sql docs/hmrc-p4b/fixture.sql \
           docs/hmrc-p4b/proposal.sql docs/hmrc-p4b/decision-b-function.sql docs/hmrc-p5/fixture.sql docs/hmrc-p5/proposal.sql docs/hmrc-p6/fixture.sql \
           docs/hmrc-p6/proposal.sql docs/hmrc-p7b/fixture.sql docs/hmrc-p7b/proposal.sql docs/hmrc-p7d/fixture.sql docs/ledger/fixture.sql \
           docs/ledger/proposal.sql docs/ledger-auto/fixture.sql docs/ledger-auto/proposal.sql docs/ledger-auto-bills/fixture.sql; do
    $P -v ON_ERROR_STOP=1 -f $f >/dev/null 2>&1 || echo "FAIL|$f"
  done
}
fresh
[ "${1:-}" = "--base-only" ] && exit 0

echo "== production shape (phase 2 and 3a applied, as read on 14 Nov 2026)"
$P -At -c "select case when md5(string_agg(relname, ',' order by relname)) = '78b3091d6049d5a502c5ee819a502465' and count(*) = 156
  then 'PASS|the 156 tables in public = production' else 'FAIL|table set' end from pg_class where relnamespace = 'public'::regnamespace and relkind in ('r','p')"
$P -At -c "select case when count(*) = 14 then 'PASS|the 14 phase 3a functions match the production hashes (raw or comment-stripped)' else 'FAIL|3a hashes: ' || count(*) end
  from (values ('_ledger_auto_apply(uuid,uuid)','49726ce6f5b6da95529dc00dfd4e10fa'),('_ledger_auto_history_guard()','b8de1a80e1075d31037ded215c7f91de'),
   ('_ledger_auto_invoice_changed()','89af0faa5a2fba2b8beee7fe93189e93'),('_ledger_auto_issue(uuid,uuid,text,text,text)','6bf2dafbd1b555db99887c229b7bbc43'),
   ('_ledger_auto_journal(uuid,date,text,text,uuid,uuid,jsonb,uuid)','8d63e691bfa7262ee35339d43d718073'),('_ledger_auto_org_ready(uuid)','ddd68b637b5c6bced8ace7e1a2a2c78e'),
   ('_ledger_auto_pence(numeric)','7513a2bf798a91f8130832431b954709'),('_ledger_auto_plan(uuid,uuid)','0832f99e94d54cad15d380145df2d628'),
   ('ledger_auto_catch_up(uuid)','f96e7a5ff5a7623c5ae41240152d07b2'),('ledger_auto_preview(uuid)','fe2ea1440edcdb94f5f0667072102eaf'),
   ('ledger_auto_run(uuid)','945d444f5a1fc50ee4e62bd4d6cd953e'),('ledger_auto_set(uuid,boolean)','bed001b9a0fa96340b819171f2adcb60'),
   ('ledger_auto_status(uuid)','8c94bfd9c512b5ff15e51320f4cfc07f'),('ledger_process_queue(uuid,integer)','4450dc44310f6c034607e8e3a4ececdf')) v(fn, h)
  join pg_proc p on p.oid = to_regprocedure('public.' || v.fn), lateral (select regexp_replace(p.prosrc, E'\\n[ \\t]*--[^\\n]*', '', 'g') l) c
  where v.h in (md5(p.prosrc), md5(c.l), md5(regexp_replace(c.l, E'[ \\t]*--[^\\n]*', '', 'g')))"

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

echo "== apply, then an empty rollback restores the exact state"
$P -v ON_ERROR_STOP=1 -f docs/ledger-auto-bills/proposal.sql >/dev/null 2>&1 || { echo "FAIL|apply"; $P -v ON_ERROR_STOP=1 -f docs/ledger-auto-bills/proposal.sql 2>&1 | grep ERROR | head -3; }
$P -At -c "select case when pg_get_constraintdef(oid) like '%auto_bill%auto_bill_payment%auto_expense%' then 'PASS|je_source_type now allows the three bill and expense types' else 'FAIL|new CHECK' end from pg_constraint where conname = 'je_source_type'"
$P -At -c "select case when (select count(*) from pg_trigger where tgname = 'ledger_auto_record' and tgrelid in ('public.bills'::regclass, 'public.expenses'::regclass)) = 2
  and (select count(*) from pg_trigger where tgrelid = 'public.invoices'::regclass and not tgisinternal) = 6 then 'PASS|bills and expenses have ledger_auto_record; invoices unchanged' else 'FAIL|triggers' end"
$P -At -c "select case when not exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and (p.proname like '%ledger_auto%' or p.proname = 'ledger_process_queue')
  and not exists (select 1 from unnest(p.proconfig) c where c = 'search_path=\"\"')) then 'PASS|every automatic-postings function sets search_path to empty' else 'FAIL|search_path' end"
$P -v ON_ERROR_STOP=1 -f docs/ledger-auto-bills/rollback.sql >/dev/null 2>&1 || { echo "FAIL|rollback"; $P -v ON_ERROR_STOP=1 -f docs/ledger-auto-bills/rollback.sql 2>&1 | grep ERROR | head -3; }
same "empty rollback: the five replaced functions back to their 3a bodies; CHECKs, column, indexes, triggers, grants, RLS and policies exactly as before"
$P -v ON_ERROR_STOP=1 -f docs/ledger-auto-bills/rollback.sql 2>&1 | grep -q 'is not applied' && echo "PASS|rollback refused when not applied" || echo "FAIL|rollback twice"

echo "== apply again and run the suite (one transaction, rolled back)"
$P -v ON_ERROR_STOP=1 -f docs/ledger-auto-bills/proposal.sql >/dev/null 2>&1 && echo "PASS|re-apply after rollback works" || echo "FAIL|re-apply"
$P -v ON_ERROR_STOP=1 -f docs/ledger-auto-bills/test.sql 2>&1 | sed -n 's/.*\(PASS|.*\)/\1/p; s/.*\(FAIL|.*\)/\1/p; /ERROR/p'
$P -At -c "select case when (select count(*) from public.ledger_postings) = 0 and (select count(*) from public.journal_entries) = 0 and (select count(*) from public.bills) = 0
  and (select count(*) from public.ledger_category_map) = 0 then 'PASS|the suite left nothing behind (rolled back)' else 'FAIL|suite rows left' end"
echo "== the phase 3a and phase 2 suites still pass with phase 3b applied"
n=$($P -v ON_ERROR_STOP=1 -f docs/ledger-auto/test.sql 2>&1 | grep -cE 'PASS\|'); f=$($P -v ON_ERROR_STOP=1 -f docs/ledger-auto/test.sql 2>&1 | grep -cE 'FAIL\||ERROR')
[ "$f" = 0 ] && [ "$n" -ge 100 ] && echo "PASS|phase 3a test.sql: $n checks pass" || { echo "FAIL|phase 3a test.sql ($n pass, $f fail)"; $P -v ON_ERROR_STOP=1 -f docs/ledger-auto/test.sql 2>&1 | grep -E 'FAIL\||ERROR' | head -3; }
n=$($P -v ON_ERROR_STOP=1 -f docs/ledger/test.sql 2>&1 | grep -cE 'PASS\|'); f=$($P -v ON_ERROR_STOP=1 -f docs/ledger/test.sql 2>&1 | grep -cE 'FAIL\||ERROR')
[ "$f" = 0 ] && [ "$n" -ge 70 ] && echo "PASS|phase 2 test.sql: $n checks pass" || echo "FAIL|phase 2 test.sql ($n pass, $f fail)"
$P -v ON_ERROR_STOP=1 -f docs/demo-readonly/check-coverage.sql 2>&1 | grep -q 'DEMO_GUARD_OK' && echo "PASS|demo coverage check passes with ledger_category_map" || echo "FAIL|demo coverage"
$P -v ON_ERROR_STOP=1 -f docs/ledger-auto-bills/proposal.sql 2>&1 | grep -q 'already exist' && echo "PASS|second apply refused (already exist)" || echo "FAIL|second apply"

echo "== rollback refuses while bill or expense postings exist"
$P -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL' || echo "FAIL|posting setup"
INSERT INTO auth.users (id, email) VALUES ('fb000000-0000-4000-8000-000000000001', 'z@example.test');
INSERT INTO public.profiles (id, email, currency_code) VALUES ('fb000000-0000-4000-8000-000000000001', 'z@example.test', 'GBP') ON CONFLICT (id) DO UPDATE SET currency_code = 'GBP';
INSERT INTO public.organizations (id, name, slug) VALUES ('0fb00000-0000-4000-8000-000000000001', 'Z', 'bill-z');
INSERT INTO public.ledger_settings (organization_id, start_date, opening_mode) VALUES ('0fb00000-0000-4000-8000-000000000001', '2026-01-01', 'fresh');
SELECT public.ledger_seed_chart('0fb00000-0000-4000-8000-000000000001');
SELECT public._ledger_auto_seed_category_map('0fb00000-0000-4000-8000-000000000001');
INSERT INTO public.expenses (id, user_id, organization_id, category, description, amount, net_amount, vat_amount, vat_rate, vat_treatment, vat_status, date, tax_point_date, status)
VALUES ('0fc00000-0000-4000-8000-000000000001', 'fb000000-0000-4000-8000-000000000001', '0fb00000-0000-4000-8000-000000000001', 'Travel', 'Train', 1.20, 1.00, 0.20, 20, 'standard', 'recorded', '2026-02-01', '2026-02-01', 'approved');
SELECT public._ledger_auto_apply_record('0fb00000-0000-4000-8000-000000000001', 'expenses', '0fc00000-0000-4000-8000-000000000001');
SQL
$P -At -c "select case when (select count(*) from public.ledger_postings where source_table = 'expenses') = 1 then 'PASS|one expense posting committed (balanced at commit)' else 'FAIL|posting' end"
$P -v ON_ERROR_STOP=1 -f docs/ledger-auto-bills/rollback.sql 2>&1 | grep -q 'holds bill or expense postings' && echo "PASS|rollback refused while bill or expense postings exist" || echo "FAIL|rollback with rows"
$P -At -c "select case when to_regclass('public.ledger_category_map') is not null then 'PASS|refused rollback changed nothing' else 'FAIL|partial rollback' end"

echo "== drift is refused before anything changes (fresh database)"
fresh
$P -c "CREATE OR REPLACE FUNCTION public._ledger_auto_plan(p_org uuid, p_invoice uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS 'SELECT ''{}''::jsonb'" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/ledger-auto-bills/proposal.sql 2>&1 | grep -q '_ledger_auto_plan.*differs' && echo "PASS|a changed 3a function is refused" || echo "FAIL|3a drift"
fresh
$P -c "CREATE TABLE public.zz_surprise (id int)" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/ledger-auto-bills/proposal.sql 2>&1 | grep -q 'tables in public differ' && echo "PASS|a changed table set is refused" || echo "FAIL|table drift"
fresh
$P -c "ALTER TABLE public.ledger_postings DROP CONSTRAINT lp_kind; ALTER TABLE public.ledger_postings ADD CONSTRAINT lp_kind CHECK (kind IN ('invoice_issued', 'invoice_paid', 'other'))" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/ledger-auto-bills/proposal.sql 2>&1 | grep -q 'lp_kind differs' && echo "PASS|a changed 3a CHECK is refused" || echo "FAIL|check drift"
$P -At -c "select case when to_regclass('public.ledger_category_map') is null then 'PASS|nothing was applied by the refused runs' else 'FAIL|partial apply' end"

echo "== follow-up (15 Nov 2026): complete the category mapping (docs/ledger-auto-bills/followup-categories.sql)"
fresh
$P -v ON_ERROR_STOP=1 -f docs/ledger-auto-bills/followup-categories.sql 2>&1 | grep -q 'ledger_category_map is missing' && echo "PASS|follow-up refused before phase 3b is applied" || echo "FAIL|follow-up without 3b"
$P -v ON_ERROR_STOP=1 -f docs/ledger-auto-bills/proposal.sql >/dev/null 2>&1 || echo "FAIL|3b apply for the follow-up"
$P -At -c "select case when md5(string_agg(relname, ',' order by relname)) = 'e8b4d718206034884fa5766884b831d5' and count(*) = 157
  then 'PASS|after phase 3b: the 157 tables = production on 15 Nov 2026' else 'FAIL|table set after 3b' end from pg_class where relnamespace = 'public'::regnamespace and relkind in ('r','p')"
fns() { $P -At -c "select string_agg(md5(prosrc), ',' order by proname) from pg_proc where proname in ('_ledger_auto_default_categories', '_ledger_auto_expense_plan')"; }
before=$(fns)
$P -v ON_ERROR_STOP=1 -f docs/ledger-auto-bills/test-category-map-before.sql >/dev/null 2>&1 || { echo "FAIL|follow-up setup"; $P -v ON_ERROR_STOP=1 -f docs/ledger-auto-bills/test-category-map-before.sql 2>&1 | grep ERROR | head -3; }
$P -At -c "select case when (select count(*) from public.ledger_post_issues where reason_code = 'category_not_mapped' and resolved_at is null) = 6
  then 'PASS|before the follow-up: transport, wages, equipment, taxes, the Equipment bill (F) and transport (G) are held' else 'FAIL|setup issues' end"
$P -v ON_ERROR_STOP=1 -f docs/ledger-auto-bills/followup-categories.sql >/dev/null 2>&1 && echo "PASS|the follow-up applies" || { echo "FAIL|follow-up apply"; $P -v ON_ERROR_STOP=1 -f docs/ledger-auto-bills/followup-categories.sql 2>&1 | grep ERROR | head -3; }
$P -v ON_ERROR_STOP=1 -f docs/ledger-auto-bills/test-category-map.sql 2>&1 | sed -n 's/.*\(PASS|.*\)/\1/p; s/.*\(FAIL|.*\)/\1/p; /ERROR/p'
state() { $P -At -c "select (select count(*) from public.ledger_category_map) || '|' || (select count(*) from public.ledger_post_queue) || '|' || (select count(*) from public.journal_entries) || '|' ||
  (select string_agg(md5(prosrc), ',' order by proname) from pg_proc where proname in ('_ledger_auto_default_categories', '_ledger_auto_expense_plan'))"; }
s1=$(state)
$P -v ON_ERROR_STOP=1 -f docs/ledger-auto-bills/followup-categories.sql >/dev/null 2>&1 && [ "$(state)" = "$s1" ] && echo "PASS|a second apply passes the guard and changes nothing (map rows, queue, journals, functions)" || echo "FAIL|second apply"
after=$(fns)
$P -v ON_ERROR_STOP=1 -f docs/ledger-auto-bills/followup-rollback.sql >/dev/null 2>&1 || { echo "FAIL|follow-up rollback"; $P -v ON_ERROR_STOP=1 -f docs/ledger-auto-bills/followup-rollback.sql 2>&1 | grep ERROR | head -3; }
[ "$(fns)" = "$before" ] && [ "$after" != "$before" ] && echo "PASS|rollback restores the exact phase 3b bodies of both functions" || echo "FAIL|rollback bodies"
$P -At -c "select case when (select count(*) from public.ledger_category_map where category_key = 'transport') = 2 then 'PASS|the added map rows are left in place (harmless)' else 'FAIL|map rows after rollback' end"
$P -v ON_ERROR_STOP=1 -f docs/ledger-auto-bills/followup-rollback.sql 2>&1 | grep -q 'is not applied' && echo "PASS|rollback refused when the follow-up is not applied" || echo "FAIL|rollback twice"
$P -v ON_ERROR_STOP=1 -f docs/ledger-auto-bills/followup-categories.sql >/dev/null 2>&1 && echo "PASS|re-apply after rollback works" || echo "FAIL|re-apply follow-up"
fresh
$P -v ON_ERROR_STOP=1 -f docs/ledger-auto-bills/proposal.sql >/dev/null 2>&1
$P -c "CREATE OR REPLACE FUNCTION public._ledger_auto_category_key(p_category text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO '' AS 'SELECT lower(p_category)'" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/ledger-auto-bills/followup-categories.sql 2>&1 | grep -q '_ledger_auto_category_key.*differs' && echo "PASS|follow-up: a changed helper is refused" || echo "FAIL|follow-up drift"
$P -At -c "select case when not exists (select 1 from public._ledger_auto_default_categories() where category_key = 'transport') then 'PASS|nothing was applied by the refused follow-up' else 'FAIL|partial follow-up' end"
$R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1
