-- Finance phase 3b follow-up tests, part 2 (DISPOSABLE local Postgres only): after followup-categories.sql. One
-- transaction, rolled back. The state comes from test-category-map-before.sql.
\set ON_ERROR_STOP 1
BEGIN;
\i docs/phase37/test-helpers.sql
CREATE FUNCTION pg_temp.f() RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT '0fd00000-0000-4000-8000-000000000001'::uuid $$;
CREATE FUNCTION pg_temp.e(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('0fe00000-0000-4000-8000-00000000000' || n)::uuid $$;
CREATE FUNCTION pg_temp.live(src uuid) RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT entry_id FROM public.ledger_postings WHERE source_id = src AND reversed_at IS NULL $$;
CREATE FUNCTION pg_temp.issue(src uuid) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT reason_code FROM public.ledger_post_issues WHERE source_id = src AND resolved_at IS NULL $$;
CREATE FUNCTION pg_temp.code(e uuid) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT a.code FROM public.journal_lines l JOIN public.ledger_accounts a ON a.id = l.account_id WHERE l.entry_id = e AND l.line_no = 1 $$;

\echo '== every app category has a decision'
DO $$
DECLARE v_app text[] := ARRAY[  -- EXPENSE_CATEGORY_GROUPS in src/lib/moneyOut.ts (Vitest keeps this decision list in step with it)
    'office_costs', 'rent_rates', 'utilities', 'telephone_internet', 'software_subscriptions', 'repairs_maintenance', 'postage_delivery',
    'transport', 'vehicle_running', 'fuel', 'food', 'entertainment', 'marketing_advertising', 'wages_salaries', 'subcontractors', 'training_courses',
    'stock_materials', 'equipment_tools', 'professional_fees', 'bank_finance_charges', 'insurance', 'licences_memberships', 'taxes_duties', 'other'];
  v_unmapped text[] := ARRAY['wages_salaries', 'taxes_duties', 'equipment_tools', 'equipment', 'shopping', 'health'];
  v_missing text;
BEGIN
  PERFORM pg_temp.ok((SELECT count(*) FROM public._ledger_auto_default_categories()) = 40, 'the standard mapping: 27 phase 3b rows kept, 13 added');
  SELECT string_agg(k, ', ') INTO v_missing FROM unnest(v_app) k
   WHERE NOT (k = ANY (v_unmapped))
     AND NOT EXISTS (SELECT 1 FROM public._ledger_auto_default_categories() d JOIN public.ledger_accounts a ON a.organization_id = pg_temp.f()
                       AND ((d.system_key IS NOT NULL AND a.system_key = d.system_key) OR (d.system_key IS NULL AND a.code = d.code)) WHERE d.category_key = k);
  PERFORM pg_temp.ok(v_missing IS NULL, 'every app category is mapped to an existing account or deliberately left unmapped' || COALESCE(' (missing: ' || v_missing || ')', ''));
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public._ledger_auto_default_categories() d WHERE d.category_key = ANY (v_unmapped)), 'the deliberately unmapped categories are not in the standard mapping');
  PERFORM pg_temp.ok(EXISTS (SELECT 1 FROM public._ledger_auto_default_categories() d WHERE d.category_key = 'subcontractors' AND d.system_key = 'cost_of_sales')
    AND (SELECT code FROM public._ledger_auto_default_categories() WHERE category_key = 'bank_finance_charges') = '7900', 'subcontractors → Cost of sales; bank_finance_charges → 7900');
END $$;

\echo '== backfill: missing keys added, company edits kept'
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT count(*) FROM public.ledger_category_map WHERE organization_id = pg_temp.f()) = 40, 'F''s map: 27 + its own fuel row + the 12 other new keys (fuel kept, not re-added)');
  PERFORM pg_temp.ok((SELECT a.code FROM public.ledger_category_map m JOIN public.ledger_accounts a ON a.id = m.account_id WHERE m.organization_id = pg_temp.f() AND m.category_key = 'transport') = '7400',
    'transport → 7400 Travel');
  PERFORM pg_temp.ok((SELECT a.code || ':' || m.is_default FROM public.ledger_category_map m JOIN public.ledger_accounts a ON a.id = m.account_id WHERE m.organization_id = pg_temp.f() AND m.category_key = 'rent') = '8200:false'
    AND (SELECT a.code || ':' || m.is_default FROM public.ledger_category_map m JOIN public.ledger_accounts a ON a.id = m.account_id WHERE m.organization_id = pg_temp.f() AND m.category_key = 'fuel') = '7500:false',
    'the company''s own rows survive: rent still → 8200, fuel still → 7500');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.ledger_category_map WHERE category_key IN ('wages_salaries', 'taxes_duties', 'equipment_tools', 'equipment')), 'nothing deliberately unmapped was added');
END $$;

\echo '== the queue: held records that can now post, nothing else'
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT array_agg(source_id ORDER BY source_id) FROM public.ledger_post_queue) = ARRAY[pg_temp.e(3)], 'only F''s held transport expense is queued (not wages, equipment, taxes, the Equipment bill, or company G, whose switch is off)');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.journal_entries WHERE organization_id = pg_temp.f()) = 2, 'posted history untouched: the two journals from before');
END $$;
DO $$ DECLARE old_office uuid := pg_temp.live(pg_temp.e(2)); BEGIN
  PERFORM public.ledger_process_queue();
  PERFORM pg_temp.ok(pg_temp.code(pg_temp.live(pg_temp.e(3))) = '7400' AND pg_temp.issue(pg_temp.e(3)) IS NULL, 'the held transport expense posts to 7400 Travel, and its issue resolves');
  PERFORM pg_temp.ok((SELECT memo FROM public.journal_entries WHERE id = pg_temp.live(pg_temp.e(3))) = 'Expense: Transport 14 Feb', 'its memo is readable');
  PERFORM pg_temp.ok(pg_temp.issue(pg_temp.e(4)) = 'category_not_mapped' AND pg_temp.issue(pg_temp.e(5)) = 'category_not_mapped'
    AND pg_temp.issue(pg_temp.e(6)) = 'category_not_mapped' AND pg_temp.issue(pg_temp.e(9)) = 'category_not_mapped', 'wages, equipment_tools, taxes and the Equipment bill stay held');
  -- The office_costs expense posted before the follow-up (memo "Expense: office_costs 14 Feb"); looking at it again
  -- with the new memo rule changes nothing, because the memo is not part of version_hash.
  INSERT INTO public.ledger_post_queue (organization_id, source_table, source_id) VALUES (pg_temp.f(), 'expenses', pg_temp.e(2)), (pg_temp.f(), 'expenses', pg_temp.e(1));
  PERFORM public.ledger_process_queue();
  PERFORM pg_temp.ok(pg_temp.live(pg_temp.e(2)) = old_office AND NOT EXISTS (SELECT 1 FROM public.journal_entries WHERE reverses_entry_id IS NOT NULL),
    'an expense posted before keeps its journal: no reversal, no repost (version_hash unchanged)');
  PERFORM pg_temp.ok((SELECT memo FROM public.journal_entries WHERE id = old_office) = 'Expense: office_costs 14 Feb', 'its old memo stays as it was (history is not edited)');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.journal_entries WHERE organization_id = pg_temp.f()) = 3, 'three journals: the two from before and the transport one');
  INSERT INTO public.expenses (user_id, organization_id, category, description, amount, net_amount, vat_amount, vat_rate, vat_treatment, vat_status, date, tax_point_date, status)
  VALUES ('fd000000-0000-4000-8000-000000000001', pg_temp.f(), 'office_costs', 'Paper', 6.00, 5.00, 1.00, 20, 'standard', 'recorded', '2026-11-14', '2026-11-14', 'approved');
  PERFORM public.ledger_process_queue();
  PERFORM pg_temp.ok(EXISTS (SELECT 1 FROM public.journal_entries WHERE memo = 'Expense: Office costs 14 Nov'), 'a new expense: "Expense: Office costs 14 Nov"');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.ledger_post_queue WHERE organization_id = '0fd00000-0000-4000-8000-000000000002') = 0
    AND (SELECT reason_code FROM public.ledger_post_issues WHERE source_id = pg_temp.e(8) AND resolved_at IS NULL) = 'category_not_mapped',
    'company G (switch off): its held expense is not queued and stays as it was until it switches back on');
END $$;
ROLLBACK;
