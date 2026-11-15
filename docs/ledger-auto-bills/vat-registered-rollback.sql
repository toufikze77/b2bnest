-- Finance phase 3b follow-up 2 rollback (one transaction): puts _ledger_auto_bill_plan, _ledger_auto_expense_plan and
-- ledger_auto_status back to their exact bodies before this change (phase 3b; the expense plan as the #103 follow-up
-- left it), and drops ledger_vat_registered_set and _ledger_auto_vat_registered.
-- The vat_registered and vat_registered_from columns are left in place on purpose: they are harmless once nothing reads
-- them, and keeping them keeps each company's answer if the change is applied again (like the map rows in the #103
-- rollback). (A re-apply then needs its "already exists" check relaxed by hand; that is the only consequence.)
-- Journals posted meanwhile stay (append-only). Records without recorded VAT are held as "VAT details missing" again
-- from their next look, as before.
BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.ledger_vat_registered_set(uuid,boolean,date)') IS NULL THEN RAISE EXCEPTION 'the VAT registered setting is not applied'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public._ledger_auto_bill_plan(p_org uuid, p_bill uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  b public.bills; s public.ledger_settings; v_status text; v_net bigint; v_vat bigint; v_gross bigint; v_date date; v_pay date;
  v_reason text; v_pay_reason text; v_cat jsonb; v_reclaim boolean; v_label text; v_who text;
  v_creditors uuid; v_vat_acc uuid; v_bank uuid; v_none jsonb := jsonb_build_object('want', false);
  v_received jsonb := v_none; v_paid jsonb := v_none;
BEGIN
  SELECT * INTO b FROM public.bills WHERE id = p_bill;
  SELECT * INTO s FROM public.ledger_settings WHERE organization_id = p_org;
  v_label := left(COALESCE(NULLIF(btrim(b.bill_number), ''), 'from ' || btrim(b.vendor_name)), 120);
  IF NOT FOUND OR b.id IS NULL OR b.organization_id IS DISTINCT FROM p_org THEN
    RETURN jsonb_build_object('label', v_label, 'poster', b.user_id, 'kinds', jsonb_build_object('bill_received', v_none, 'bill_paid', v_none));
  END IF;
  v_status := lower(btrim(COALESCE(b.status, '')));
  IF v_status NOT IN ('pending', 'overdue', 'paid') THEN -- cancelled (and anything else) never posts
    RETURN jsonb_build_object('label', v_label, 'poster', b.user_id, 'kinds', jsonb_build_object('bill_received', v_none, 'bill_paid', v_none));
  END IF;
  v_who := CASE WHEN NULLIF(btrim(b.bill_number), '') IS NOT NULL THEN btrim(b.bill_number) || ' from ' || btrim(b.vendor_name) ELSE 'from ' || btrim(b.vendor_name) END;
  v_date := COALESCE(b.tax_point_date, b.issue_date);
  v_gross := public._ledger_auto_pence(b.amount); v_net := public._ledger_auto_pence(b.net_amount); v_vat := public._ledger_auto_pence(b.vat_amount);
  v_cat := public._ledger_auto_category_account(p_org, b.category);
  v_reclaim := b.vat_reclaimable AND COALESCE(v_vat, 0) > 0;
  v_reason := CASE
    WHEN upper(btrim(COALESCE(b.currency, ''))) <> 'GBP' THEN 'currency_not_gbp'
    WHEN b.amount IS NULL THEN 'amounts_missing'
    WHEN b.vat_status IS DISTINCT FROM 'recorded' OR b.net_amount IS NULL OR b.vat_amount IS NULL THEN 'vat_details_missing'
    WHEN v_gross IS NULL OR v_net IS NULL OR v_vat IS NULL THEN 'not_whole_pence'
    WHEN v_gross < 0 OR v_net < 0 OR v_vat < 0 THEN 'negative_amount'
    WHEN v_gross = 0 THEN 'zero_total'
    WHEN v_net + v_vat <> v_gross THEN 'amounts_do_not_add_up'
    WHEN v_cat ? 'reason' THEN v_cat ->> 'reason'
    WHEN v_date < s.start_date THEN 'before_start'
    WHEN s.locked_through IS NOT NULL AND v_date <= s.locked_through THEN 'period_locked'
  END;
  SELECT a.id INTO v_creditors FROM public.ledger_accounts a WHERE a.organization_id = p_org AND a.system_key = 'creditors';
  SELECT a.id INTO v_vat_acc FROM public.ledger_accounts a WHERE a.organization_id = p_org AND a.system_key = 'vat_control';
  SELECT a.id INTO v_bank FROM public.ledger_accounts a WHERE a.organization_id = p_org AND a.system_key = 'bank';
  v_received := public._ledger_auto_want(v_reason, v_date, 'Bill ' || v_who || ' received', 'auto_bill',
    jsonb_build_array(
      jsonb_build_object('account_id', v_cat ->> 'account_id', 'debit', v_net + CASE WHEN v_reclaim THEN 0 ELSE v_vat END, 'credit', 0),
      jsonb_build_object('account_id', v_vat_acc, 'debit', CASE WHEN v_reclaim THEN v_vat ELSE 0 END, 'credit', 0),
      jsonb_build_object('account_id', v_creditors, 'debit', 0, 'credit', v_gross)),
    v_gross, md5(concat_ws('|', 'v1', 'bill', b.bill_number, b.vendor_name, v_date, v_net, v_vat, v_gross, v_reclaim, v_cat ->> 'account_id')));
  IF v_status = 'paid' THEN
    v_pay := b.paid_date;
    v_pay_reason := CASE
      WHEN b.paid_date IS NULL THEN 'paid_date_missing'
      WHEN v_pay < s.start_date THEN 'before_start'
      WHEN s.locked_through IS NOT NULL AND v_pay <= s.locked_through THEN 'period_locked'
      WHEN v_reason IS NOT NULL THEN 'issue_not_posted'
    END;
    -- One row is enough when both are before the start date (the received row says it).
    IF v_reason = 'before_start' AND v_pay_reason = 'before_start' THEN
      v_paid := v_none;
    ELSE
      v_paid := public._ledger_auto_want(v_pay_reason, v_pay, 'Bill ' || COALESCE(NULLIF(btrim(b.bill_number), ''), 'from ' || btrim(b.vendor_name)) || ' paid', 'auto_bill_payment',
        jsonb_build_array(jsonb_build_object('account_id', v_creditors, 'debit', v_gross, 'credit', 0),
                          jsonb_build_object('account_id', v_bank, 'debit', 0, 'credit', v_gross)),
        v_gross, md5(concat_ws('|', 'v1', 'billpay', b.bill_number, b.vendor_name, v_pay, v_gross)), 'bill_received');
    END IF;
  END IF;
  RETURN jsonb_build_object('label', v_label, 'poster', b.user_id, 'kinds', jsonb_build_object('bill_received', v_received, 'bill_paid', v_paid));
END;
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

CREATE OR REPLACE FUNCTION public.ledger_auto_status(p_org uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_rule text; a public.ledger_auto_settings;
BEGIN
  PERFORM public.require_aal2_if_enrolled();
  v_rule := public._ledger_rule(p_org, auth.uid());
  IF v_rule IN ('not_signed_in', 'not_member', 'closed') THEN RAISE EXCEPTION 'LEDGER_%', upper(v_rule) USING ERRCODE = '42501'; END IF;
  SELECT * INTO a FROM public.ledger_auto_settings WHERE organization_id = p_org;
  RETURN jsonb_build_object(
    'access', CASE WHEN v_rule IN ('ok', 'not_admin') THEN 'ok' ELSE v_rule END,
    'can_manage', v_rule = 'ok',
    'set_up', EXISTS (SELECT 1 FROM public.ledger_settings s WHERE s.organization_id = p_org),
    'invoices_enabled', COALESCE(a.invoices_enabled, false),
    'bills_enabled', COALESCE(a.bills_enabled, false),
    'enabled_at', a.enabled_at,
    'waiting', (SELECT count(DISTINCT source_id) FROM public.ledger_post_queue q WHERE q.organization_id = p_org),
    'open_issues', (SELECT count(*) FROM public.ledger_post_issues i WHERE i.organization_id = p_org AND i.resolved_at IS NULL));
END;
$function$;

DROP FUNCTION public.ledger_vat_registered_set(uuid, boolean, date);
DROP FUNCTION public._ledger_auto_vat_registered(uuid, date);
REVOKE ALL ON FUNCTION public._ledger_auto_bill_plan(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._ledger_auto_expense_plan(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
