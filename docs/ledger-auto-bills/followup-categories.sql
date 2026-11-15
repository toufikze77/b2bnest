-- =====================================================================================================================
-- Finance phase 3b follow-up: complete the bill and expense category mapping. PREPARED, NOT APPLIED.
-- Read docs/ledger-auto-bills/README.md ("Applied state / follow-up") first. One transaction, additive, guarded.
--
--  1. _ledger_auto_default_categories() (CREATE OR REPLACE, same signature): every 3b row kept, plus the values the app
--     really stores (src/lib/moneyOut.ts). Deliberately not mapped: wages_salaries, taxes_duties, equipment_tools,
--     equipment, shopping, health (they stay under Needs attention; see the README for why).
--  2. Backfill: for every company that already has a category map, _ledger_auto_seed_category_map adds the missing keys
--     (ON CONFLICT DO NOTHING: a row that exists, including a company's own edit, is never changed or deleted). Then
--     every bill or expense held as "category not mapped", in a company with bills and expenses switched on, whose
--     category now has a map row, gets a queue row (queue rows only), so it posts on the next run. Posted history is
--     never touched.
--  3. _ledger_auto_expense_plan(uuid,uuid) (CREATE OR REPLACE): the memo uses the readable category ("Expense: Office
--     costs 14 Nov"). Nothing else in it changes; version_hash is unchanged, so nothing is reversed or posted again.
-- Not changed: any table, any other function, the "VAT details missing" behaviour, plans, prices, Stripe, HMRC.
--
-- Production facts (15 Nov 2026): 157 tables in public after phase 3b (md5 of the sorted names
-- e8b4d718206034884fa5766884b831d5), ledger_category_map present, and md5(prosrc) of the six functions below as
-- production stores them (accepted raw, without whole-line comments, or without any comment, as in phase 3b). The two
-- replaced functions are also accepted in their follow-up form, so a second apply passes the guard and changes
-- nothing: the functions are the same, the backfill inserts nothing (ON CONFLICT DO NOTHING) and no record is queued
-- (every newly mapped held record was already queued and posted).
-- Rollback: docs/ledger-auto-bills/followup-rollback.sql. Tests: docs/ledger-auto-bills/run-test.sh (follow-up section).
-- =====================================================================================================================
BEGIN;

DO $$
DECLARE r record;
BEGIN
  IF to_regclass('public.ledger_category_map') IS NULL THEN RAISE EXCEPTION 'ledger_category_map is missing: apply Finance phase 3b first'; END IF;
  IF (SELECT md5(string_agg(relname, ',' ORDER BY relname)) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind IN ('r', 'p'))
     IS DISTINCT FROM 'e8b4d718206034884fa5766884b831d5' THEN
    RAISE EXCEPTION 'the tables in public differ from production after phase 3b (15 Nov 2026)';
  END IF;
  FOR r IN SELECT fn, array_agg(h) AS hs FROM (VALUES
      ('public._ledger_auto_default_categories()', '576f7ee41515f009da3ed51cb6e479e1'),
      ('public._ledger_auto_default_categories()', 'e1a07fa1d61b47f94d8d113f567ef519'), -- the follow-up body (second apply)
      ('public._ledger_auto_default_categories()', '94525011ccd268bf653c3dc68640dcd8'), -- the same, comments removed
      ('public._ledger_auto_seed_category_map(uuid)', '2f9d0d0108ec31c63b40a04a3f37f092'),
      ('public._ledger_auto_expense_plan(uuid,uuid)', '0bf69794b7ed3e42f0c1f68319116028'),
      ('public._ledger_auto_expense_plan(uuid,uuid)', '8de9e2eb69d69f3d6edd424665d63f73'), -- the follow-up body (second apply)
      ('public._ledger_auto_expense_plan(uuid,uuid)', '8f25c172bd5fd33b7d7fb684c0b51390'), -- the same, comments removed
      ('public._ledger_auto_bill_plan(uuid,uuid)', '4387a60cd9a75ead2bd9d158105bd0c6'),
      ('public._ledger_auto_category_account(uuid,text)', '73f5badd79d04900a5c010e91f372392'),
      ('public._ledger_auto_category_key(text)', '147e4f38f0deaa3a69e9ca19dd49e1b6')) x(fn, h) GROUP BY fn LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc p, LATERAL (SELECT regexp_replace(p.prosrc, E'\\n[ \\t]*--[^\\n]*', '', 'g') AS lines) c
                    WHERE p.oid = to_regprocedure(r.fn)
                      AND (md5(p.prosrc) = ANY (r.hs) OR md5(c.lines) = ANY (r.hs) OR md5(regexp_replace(c.lines, E'[ \\t]*--[^\\n]*', '', 'g')) = ANY (r.hs))) THEN
      RAISE EXCEPTION '% differs from the body this was written against (or is missing)', r.fn;
    END IF;
  END LOOP;
END $$;

-- 1. The standard mapping, completed.
CREATE OR REPLACE FUNCTION public._ledger_auto_default_categories()
 RETURNS TABLE(category_key text, code text, system_key text)
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  SELECT * FROM (VALUES
    ('rent', '7100', NULL), ('rent_and_rates', '7100', NULL),
    ('utilities', '7200', NULL), ('telephone_internet', '7200', NULL),
    ('travel', '7400', NULL),
    ('office_costs', '7500', NULL), ('office_supplies', '7500', NULL), ('postage', '7500', NULL), ('stationery', '7500', NULL),
    ('professional_fees', '7600', NULL), ('design', '7600', NULL), ('accountancy', '7600', NULL), ('legal', '7600', NULL),
    ('software', '7700', NULL), ('software_and_subscriptions', '7700', NULL), ('software_subscription', '7700', NULL),
    ('software_subscriptions', '7700', NULL), ('subscriptions', '7700', NULL),
    ('bank_charges', '7900', NULL),
    ('insurance', '8200', NULL), ('marketing', '8200', NULL), ('advertising', '8200', NULL), ('meals_and_entertainment', '8200', NULL),
    ('other', '8200', NULL), ('general', '8200', NULL),
    ('stock_materials', NULL, 'cost_of_sales'), ('cost_of_sales', NULL, 'cost_of_sales'),
    -- Follow-up (15 Nov 2026): the values the app really stores (src/lib/moneyOut.ts, EXPENSE_CATEGORY_GROUPS).
    ('transport', '7400', NULL), ('vehicle_running', '7400', NULL), ('fuel', '7400', NULL), ('food', '7400', NULL),
    ('rent_rates', '7100', NULL),
    ('postage_delivery', '7500', NULL),
    ('bank_finance_charges', '7900', NULL),
    ('entertainment', '8200', NULL), ('repairs_maintenance', '8200', NULL), ('marketing_advertising', '8200', NULL),
    ('training_courses', '8200', NULL), ('licences_memberships', '8200', NULL),
    ('subcontractors', NULL, 'cost_of_sales')
    -- Deliberately not mapped (Needs attention until a person decides): wages_salaries (payroll comes later),
    -- taxes_duties (needs a person to decide), equipment_tools and equipment (may be a fixed asset), shopping and
    -- health (old values with no business meaning).
  ) AS d(category_key, code, system_key);
$function$;

-- 3. The readable expense memo.
CREATE OR REPLACE FUNCTION public._ledger_auto_expense_plan(p_org uuid, p_expense uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  e public.expenses; s public.ledger_settings; v_status text; v_net bigint; v_vat bigint; v_gross bigint; v_date date;
  v_reason text; v_cat jsonb; v_reclaim boolean; v_label text; v_cur text; v_vat_acc uuid; v_bank uuid; v_want jsonb := jsonb_build_object('want', false);
  v_readable text;
BEGIN
  SELECT * INTO e FROM public.expenses WHERE id = p_expense;
  SELECT * INTO s FROM public.ledger_settings WHERE organization_id = p_org;
  v_label := left(COALESCE(NULLIF(btrim(e.category), ''), 'Uncategorised'), 100);
  -- Follow-up: the memo reads "Expense: Office costs 14 Nov", not "Expense: office_costs 14 Nov". The memo is not part
  -- of version_hash, so nothing already posted is reversed or posted again because of it.
  v_readable := replace(v_label, '_', ' ');
  v_readable := upper(left(v_readable, 1)) || substr(v_readable, 2);
  IF NOT FOUND OR e.id IS NULL OR e.organization_id IS DISTINCT FROM p_org
     OR lower(btrim(COALESCE(e.status, ''))) NOT IN ('approved', 'paid') THEN
    RETURN jsonb_build_object('label', v_label, 'poster', e.user_id, 'kinds', jsonb_build_object('expense', v_want));
  END IF;
  SELECT upper(btrim(COALESCE(p.currency_code, ''))) INTO v_cur FROM public.profiles p WHERE p.id = e.user_id;
  v_date := COALESCE(e.tax_point_date, e.date);
  v_gross := public._ledger_auto_pence(e.amount); v_net := public._ledger_auto_pence(e.net_amount); v_vat := public._ledger_auto_pence(e.vat_amount);
  v_cat := public._ledger_auto_category_account(p_org, e.category);
  v_reclaim := e.vat_reclaimable AND COALESCE(v_vat, 0) > 0;
  v_reason := CASE
    WHEN COALESCE(v_cur, '') <> 'GBP' THEN 'currency_not_gbp'
    WHEN e.amount IS NULL THEN 'amounts_missing'
    WHEN e.vat_status IS DISTINCT FROM 'recorded' OR e.net_amount IS NULL OR e.vat_amount IS NULL THEN 'vat_details_missing'
    WHEN v_gross IS NULL OR v_net IS NULL OR v_vat IS NULL THEN 'not_whole_pence'
    WHEN v_gross < 0 OR v_net < 0 OR v_vat < 0 THEN 'negative_amount'
    WHEN v_gross = 0 THEN 'zero_total'
    WHEN v_net + v_vat <> v_gross THEN 'amounts_do_not_add_up'
    WHEN v_cat ? 'reason' THEN v_cat ->> 'reason'
    WHEN v_date < s.start_date THEN 'before_start'
    WHEN s.locked_through IS NOT NULL AND v_date <= s.locked_through THEN 'period_locked'
  END;
  SELECT a.id INTO v_vat_acc FROM public.ledger_accounts a WHERE a.organization_id = p_org AND a.system_key = 'vat_control';
  SELECT a.id INTO v_bank FROM public.ledger_accounts a WHERE a.organization_id = p_org AND a.system_key = 'bank';
  v_want := public._ledger_auto_want(v_reason, v_date, 'Expense: ' || v_readable || ' ' || to_char(v_date, 'FMDD Mon'), 'auto_expense',
    jsonb_build_array(
      jsonb_build_object('account_id', v_cat ->> 'account_id', 'debit', v_net + CASE WHEN v_reclaim THEN 0 ELSE v_vat END, 'credit', 0),
      jsonb_build_object('account_id', v_vat_acc, 'debit', CASE WHEN v_reclaim THEN v_vat ELSE 0 END, 'credit', 0),
      jsonb_build_object('account_id', v_bank, 'debit', 0, 'credit', v_gross)),
    v_gross, md5(concat_ws('|', 'v1', 'expense', e.category, v_date, v_net, v_vat, v_gross, v_reclaim, v_cat ->> 'account_id')));
  RETURN jsonb_build_object('label', v_label, 'poster', e.user_id, 'kinds', jsonb_build_object('expense', v_want));
END;
$function$;

-- 2. Backfill the companies that already have a map, then queue what can now post.
DO $$
DECLARE v_org uuid;
BEGIN
  FOR v_org IN SELECT DISTINCT m.organization_id FROM public.ledger_category_map m ORDER BY 1 LOOP
    PERFORM public._ledger_auto_seed_category_map(v_org);
  END LOOP;
  INSERT INTO public.ledger_post_queue (organization_id, source_table, source_id)
  SELECT i.organization_id, i.source_table, i.source_id
    FROM public.ledger_post_issues i
    JOIN public.ledger_auto_settings a ON a.organization_id = i.organization_id AND a.bills_enabled
   WHERE i.resolved_at IS NULL AND i.reason_code = 'category_not_mapped' AND i.source_table IN ('bills', 'expenses')
     AND EXISTS (SELECT 1 FROM public.ledger_category_map m WHERE m.organization_id = i.organization_id
                   AND m.category_key = public._ledger_auto_category_key(CASE i.source_table
                         WHEN 'bills' THEN (SELECT b.category FROM public.bills b WHERE b.id = i.source_id)
                         ELSE (SELECT e.category FROM public.expenses e WHERE e.id = i.source_id) END))
     AND NOT EXISTS (SELECT 1 FROM public.ledger_post_queue q WHERE q.organization_id = i.organization_id AND q.source_table = i.source_table AND q.source_id = i.source_id);
END $$;

-- Privileges as phase 3b (CREATE OR REPLACE keeps them; restated so a reader sees them).
REVOKE ALL ON FUNCTION public._ledger_auto_default_categories() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._ledger_auto_expense_plan(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
