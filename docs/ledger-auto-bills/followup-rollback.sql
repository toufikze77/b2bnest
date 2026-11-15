-- Finance phase 3b follow-up rollback (one transaction): puts _ledger_auto_default_categories() and
-- _ledger_auto_expense_plan(uuid,uuid) back to their exact phase 3b bodies (docs/ledger-auto-bills/proposal.sql).
-- The map rows the follow-up added are harmless and left in place: they are ordinary map rows (a later edit screen can
-- change them), and removing them could undo a company's own choice. Journals posted meanwhile stay (append-only);
-- their memos keep the readable wording.
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public._ledger_auto_default_categories() d WHERE d.category_key = 'transport') THEN
    RAISE EXCEPTION 'the category mapping follow-up is not applied';
  END IF;
END $$;

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
    ('stock_materials', NULL, 'cost_of_sales'), ('cost_of_sales', NULL, 'cost_of_sales')
  ) AS d(category_key, code, system_key);
$function$;

CREATE OR REPLACE FUNCTION public._ledger_auto_expense_plan(p_org uuid, p_expense uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  e public.expenses; s public.ledger_settings; v_status text; v_net bigint; v_vat bigint; v_gross bigint; v_date date;
  v_reason text; v_cat jsonb; v_reclaim boolean; v_label text; v_cur text; v_vat_acc uuid; v_bank uuid; v_want jsonb := jsonb_build_object('want', false);
BEGIN
  SELECT * INTO e FROM public.expenses WHERE id = p_expense;
  SELECT * INTO s FROM public.ledger_settings WHERE organization_id = p_org;
  v_label := left(COALESCE(NULLIF(btrim(e.category), ''), 'Uncategorised'), 100);
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
  v_want := public._ledger_auto_want(v_reason, v_date, 'Expense: ' || v_label || ' ' || to_char(v_date, 'FMDD Mon'), 'auto_expense',
    jsonb_build_array(
      jsonb_build_object('account_id', v_cat ->> 'account_id', 'debit', v_net + CASE WHEN v_reclaim THEN 0 ELSE v_vat END, 'credit', 0),
      jsonb_build_object('account_id', v_vat_acc, 'debit', CASE WHEN v_reclaim THEN v_vat ELSE 0 END, 'credit', 0),
      jsonb_build_object('account_id', v_bank, 'debit', 0, 'credit', v_gross)),
    v_gross, md5(concat_ws('|', 'v1', 'expense', e.category, v_date, v_net, v_vat, v_gross, v_reclaim, v_cat ->> 'account_id')));
  RETURN jsonb_build_object('label', v_label, 'poster', e.user_id, 'kinds', jsonb_build_object('expense', v_want));
END;
$function$;

REVOKE ALL ON FUNCTION public._ledger_auto_default_categories() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._ledger_auto_expense_plan(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
