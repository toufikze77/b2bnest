-- =====================================================================================================================
-- Finance phase 3b follow-up 2: "Is this company VAT registered?" for bill and expense postings. PREPARED, NOT APPLIED.
-- Read docs/ledger-auto-bills/README.md ("Applied state / VAT registered") first. One transaction, guarded.
--
--  1. ledger_auto_settings: + vat_registered boolean NOT NULL DEFAULT false, + vat_registered_from date (columns on an
--     existing table, so the 157-table guard of the earlier scripts stays valid; no new table).
--  2. _ledger_auto_vat_registered(org, date): registered on that date? (false when there is no settings row.)
--  3. _ledger_auto_bill_plan and _ledger_auto_expense_plan (CREATE OR REPLACE, same signatures; every other reason and
--     their order unchanged): recorded VAT posts exactly as before; otherwise, not registered (or dated before
--     vat_registered_from) = the whole amount as the cost, no VAT line; otherwise held as vat_details_missing.
--     version_hash does not include the setting, and a no-VAT journal already posted for the same version is kept,
--     so switching never reverses or reposts anything by itself.
--  4. ledger_vat_registered_set(p_org, p_registered, p_from): owners and admins (the ledger writer rule: plan, aal2 when
--     enrolled, demo and closed companies refused); one audit_logs row per real change (ledger.vat_registered_on/_off);
--     on a change, the company's held vat_details_missing bills and expenses (bills and expenses switched on) get queue
--     rows, so those that now qualify post on the next run.
--  5. ledger_auto_status (CREATE OR REPLACE): + vat_registered, vat_registered_from (every existing key kept).
--  6. Backfill: vat_registered = true (vat_registered_from empty) for every open company with an HMRC connection row,
--     a saved VAT number (hmrc_settings.vat_number), or any invoice, bill or expense with VAT recorded above zero.
--     Every other company stays No (the default). How many each rule flips: the query at the end of this file.
-- Not changed: invoices posting, the category map, the queue runner, the cron job, plans, prices, Stripe, HMRC, the
-- VAT return, any other table or function.
-- A second apply is refused (the columns exist): it must not run the backfill again over a company's own choice.
-- Rollback: docs/ledger-auto-bills/vat-registered-rollback.sql. Tests: docs/ledger-auto-bills/run-test.sh.
-- =====================================================================================================================
BEGIN;

DO $$
DECLARE r record;
BEGIN
  IF to_regclass('public.ledger_category_map') IS NULL THEN RAISE EXCEPTION 'apply Finance phase 3b first'; END IF;
  IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.ledger_auto_settings'::regclass AND attname IN ('vat_registered', 'vat_registered_from') AND NOT attisdropped) THEN
    RAISE EXCEPTION 'the VAT registered setting already exists (applied twice?)';
  END IF;
  IF (SELECT md5(string_agg(relname, ',' ORDER BY relname)) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind IN ('r', 'p'))
     IS DISTINCT FROM 'e8b4d718206034884fa5766884b831d5' THEN
    RAISE EXCEPTION 'the tables in public differ from production after phase 3b (15 Nov 2026)';
  END IF;
  FOR r IN SELECT fn, array_agg(h) AS hs FROM (VALUES
      -- Supplied by the owner (15 Nov 2026, after the #103 follow-up is applied). Requires #103: the expense plan and
      -- the default categories are accepted only in their #103 form.
      ('public._ledger_auto_default_categories()', 'e1a07fa1d61b47f94d8d113f567ef519'), ('public._ledger_auto_default_categories()', '94525011ccd268bf653c3dc68640dcd8'),
      ('public._ledger_auto_expense_plan(uuid,uuid)', '8de9e2eb69d69f3d6edd424665d63f73'), ('public._ledger_auto_expense_plan(uuid,uuid)', '8f25c172bd5fd33b7d7fb684c0b51390'),
      ('public._ledger_auto_bill_plan(uuid,uuid)', '4387a60cd9a75ead2bd9d158105bd0c6'),
      ('public._ledger_auto_seed_category_map(uuid)', '2f9d0d0108ec31c63b40a04a3f37f092'),
      ('public._ledger_auto_category_account(uuid,text)', '73f5badd79d04900a5c010e91f372392'),
      ('public._ledger_auto_category_key(text)', '147e4f38f0deaa3a69e9ca19dd49e1b6'),
      -- TODO-confirm: the owner confirms each of these against production before applying (read read-only from
      -- production on 15 Nov 2026; equal to the repository bodies). A different body: refused (fail closed).
      ('public.ledger_auto_status(uuid)', 'c121ba47cf2db074a0079c13a46f51f0'),                                 -- TODO-confirm
      ('public.ledger_auto_set(uuid,boolean,text)', 'c1ee07297290a8876ea025c953c8f018'),                        -- TODO-confirm
      ('public.ledger_auto_set(uuid,boolean)', 'f3e0cb8a7a63783b9539f62c4a579624'),                             -- TODO-confirm
      ('public._ledger_require_writer(uuid)', '75ecf4a981581daae33e90dc554f01c4'),                              -- TODO-confirm
      ('public._ledger_auto_want(text,date,text,text,jsonb,bigint,text,text)', '293c38523e4f9b1e4547e36a17a6af00') -- TODO-confirm
    ) x(fn, h) GROUP BY fn LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc p, LATERAL (SELECT regexp_replace(p.prosrc, E'\\n[ \\t]*--[^\\n]*', '', 'g') AS lines) c
                    WHERE p.oid = to_regprocedure(r.fn)
                      AND (md5(p.prosrc) = ANY (r.hs) OR md5(c.lines) = ANY (r.hs) OR md5(regexp_replace(c.lines, E'[ \\t]*--[^\\n]*', '', 'g')) = ANY (r.hs))) THEN
      RAISE EXCEPTION '% differs from the body this was written against (or is missing)', r.fn;
    END IF;
  END LOOP;
  IF to_regclass('public.hmrc_connections') IS NULL OR to_regclass('public.hmrc_settings') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.hmrc_settings'::regclass AND attname = 'vat_number' AND NOT attisdropped)
     OR NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.hmrc_connections'::regclass AND attname = 'company_id' AND NOT attisdropped) THEN
    RAISE EXCEPTION 'hmrc_connections.company_id / hmrc_settings.vat_number differ from production';
  END IF;
END $$;

-- 1. The setting.
ALTER TABLE public.ledger_auto_settings ADD COLUMN vat_registered boolean NOT NULL DEFAULT false,
  ADD COLUMN vat_registered_from date CONSTRAINT las_vat_registered_from CHECK (vat_registered_from IS NULL OR vat_registered_from BETWEEN DATE '2000-01-01' AND DATE '2100-12-31');
COMMENT ON COLUMN public.ledger_auto_settings.vat_registered IS 'Finance phase 3b follow-up 2: is this company VAT registered? Default No. Written only by ledger_vat_registered_set (and the one-off backfill).';

-- 2. Registered on a date?
CREATE FUNCTION public._ledger_auto_vat_registered(p_org uuid, p_date date)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT COALESCE((SELECT a.vat_registered AND (a.vat_registered_from IS NULL OR p_date IS NULL OR p_date >= a.vat_registered_from)
                     FROM public.ledger_auto_settings a WHERE a.organization_id = p_org), false);
$function$;
REVOKE ALL ON FUNCTION public._ledger_auto_vat_registered(uuid, date) FROM PUBLIC, anon, authenticated, service_role;

-- 3. The plans (every other line exactly as before).
CREATE OR REPLACE FUNCTION public._ledger_auto_bill_plan(p_org uuid, p_bill uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  b public.bills; s public.ledger_settings; v_status text; v_net bigint; v_vat bigint; v_gross bigint; v_date date; v_pay date;
  v_reason text; v_pay_reason text; v_cat jsonb; v_reclaim boolean; v_label text; v_who text; v_recorded boolean; v_novat boolean := false;
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
  -- VAT registered follow-up: recorded VAT always posts as recorded. Without it, a company that is not VAT registered
  -- (or a bill dated before its registration) posts the whole amount as the cost, with no VAT line. A no-VAT journal
  -- already posted for this exact version is kept even after the company says it is registered, so changing the
  -- setting never reverses or reposts anything by itself (the setting is not part of version_hash).
  v_recorded := b.vat_status = 'recorded' AND b.net_amount IS NOT NULL AND b.vat_amount IS NOT NULL;
  IF NOT v_recorded THEN
    v_novat := NOT public._ledger_auto_vat_registered(p_org, v_date)
      OR EXISTS (SELECT 1 FROM public.ledger_postings lp WHERE lp.organization_id = p_org AND lp.source_table = 'bills' AND lp.source_id = b.id
                   AND lp.kind = 'bill_received' AND lp.reversed_at IS NULL
                   AND lp.version_hash = md5(concat_ws('|', 'v1', 'bill', b.bill_number, b.vendor_name, v_date, v_gross, 0, v_gross, false, v_cat ->> 'account_id')));
    IF v_novat THEN v_net := v_gross; v_vat := 0; v_reclaim := false; END IF;
  END IF;
  v_reason := CASE
    WHEN upper(btrim(COALESCE(b.currency, ''))) <> 'GBP' THEN 'currency_not_gbp'
    WHEN b.amount IS NULL THEN 'amounts_missing'
    WHEN NOT v_recorded AND NOT v_novat THEN 'vat_details_missing'
    WHEN v_gross IS NULL OR v_net IS NULL OR v_vat IS NULL THEN 'not_whole_pence'
    WHEN v_gross < 0 OR v_net < 0 OR v_vat < 0 THEN 'negative_amount'
    WHEN v_gross = 0 THEN 'zero_total'
    WHEN v_recorded AND v_net + v_vat <> v_gross THEN 'amounts_do_not_add_up'
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
  v_readable text; v_recorded boolean; v_novat boolean := false;
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
  -- VAT registered follow-up: as in _ledger_auto_bill_plan (recorded VAT wins; otherwise not registered = the whole
  -- amount as the cost; a no-VAT journal already posted for this exact version is kept).
  v_recorded := e.vat_status = 'recorded' AND e.net_amount IS NOT NULL AND e.vat_amount IS NOT NULL;
  IF NOT v_recorded THEN
    v_novat := NOT public._ledger_auto_vat_registered(p_org, v_date)
      OR EXISTS (SELECT 1 FROM public.ledger_postings lp WHERE lp.organization_id = p_org AND lp.source_table = 'expenses' AND lp.source_id = e.id
                   AND lp.kind = 'expense' AND lp.reversed_at IS NULL
                   AND lp.version_hash = md5(concat_ws('|', 'v1', 'expense', e.category, v_date, v_gross, 0, v_gross, false, v_cat ->> 'account_id')));
    IF v_novat THEN v_net := v_gross; v_vat := 0; v_reclaim := false; END IF;
  END IF;
  v_reason := CASE
    WHEN COALESCE(v_cur, '') <> 'GBP' THEN 'currency_not_gbp'
    WHEN e.amount IS NULL THEN 'amounts_missing'
    WHEN NOT v_recorded AND NOT v_novat THEN 'vat_details_missing'
    WHEN v_gross IS NULL OR v_net IS NULL OR v_vat IS NULL THEN 'not_whole_pence'
    WHEN v_gross < 0 OR v_net < 0 OR v_vat < 0 THEN 'negative_amount'
    WHEN v_gross = 0 THEN 'zero_total'
    WHEN v_recorded AND v_net + v_vat <> v_gross THEN 'amounts_do_not_add_up'
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
REVOKE ALL ON FUNCTION public._ledger_auto_bill_plan(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._ledger_auto_expense_plan(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- 5. Status: + vat_registered, vat_registered_from.
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
    'vat_registered', COALESCE(a.vat_registered, false),
    'vat_registered_from', a.vat_registered_from,
    'enabled_at', a.enabled_at,
    'waiting', (SELECT count(DISTINCT source_id) FROM public.ledger_post_queue q WHERE q.organization_id = p_org),
    'open_issues', (SELECT count(*) FROM public.ledger_post_issues i WHERE i.organization_id = p_org AND i.resolved_at IS NULL));
END;
$function$;

-- 4. The setting's RPC.
CREATE FUNCTION public.ledger_vat_registered_set(p_org uuid, p_registered boolean, p_from date DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_was boolean; v_was_from date; v_from date;
BEGIN
  PERFORM public._ledger_require_writer(p_org);
  IF p_registered IS NULL THEN RAISE EXCEPTION 'LEDGER_BAD_REQUEST' USING ERRCODE = '22023'; END IF;
  v_from := CASE WHEN p_registered THEN p_from END;
  IF v_from IS NOT NULL AND v_from NOT BETWEEN DATE '2000-01-01' AND current_date + 366 THEN RAISE EXCEPTION 'LEDGER_BAD_DATE' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ledger_settings s WHERE s.organization_id = p_org) THEN RAISE EXCEPTION 'LEDGER_NOT_SET_UP' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('ledger:' || p_org::text, 0));
  SELECT a.vat_registered, a.vat_registered_from INTO v_was, v_was_from FROM public.ledger_auto_settings a WHERE a.organization_id = p_org;
  IF COALESCE(v_was, false) IS NOT DISTINCT FROM p_registered AND v_was_from IS NOT DISTINCT FROM v_from THEN
    RETURN public.ledger_auto_status(p_org); -- no real change: nothing written, no audit row
  END IF;
  INSERT INTO public.ledger_auto_settings AS cur (organization_id, vat_registered, vat_registered_from, updated_at) VALUES (p_org, p_registered, v_from, now())
  ON CONFLICT (organization_id) DO UPDATE SET vat_registered = EXCLUDED.vat_registered, vat_registered_from = EXCLUDED.vat_registered_from, updated_at = now();
  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, details)
  VALUES (auth.uid(), CASE WHEN p_registered THEN 'ledger.vat_registered_on' ELSE 'ledger.vat_registered_off' END, 'ledger_auto_settings', p_org::text,
          jsonb_build_object('organization_id', p_org, 'vat_registered_from', v_from));
  -- Held for missing VAT details: look at them again (queue rows only). Nothing posted is reversed: the plans keep a
  -- journal already posted whichever way the setting goes.
  INSERT INTO public.ledger_post_queue (organization_id, source_table, source_id)
  SELECT i.organization_id, i.source_table, i.source_id FROM public.ledger_post_issues i
    JOIN public.ledger_auto_settings a ON a.organization_id = i.organization_id AND a.bills_enabled
   WHERE i.organization_id = p_org AND i.resolved_at IS NULL AND i.reason_code = 'vat_details_missing' AND i.source_table IN ('bills', 'expenses')
     AND NOT EXISTS (SELECT 1 FROM public.ledger_post_queue q WHERE q.organization_id = i.organization_id AND q.source_table = i.source_table AND q.source_id = i.source_id);
  RETURN public.ledger_auto_status(p_org);
END;
$function$;
REVOKE ALL ON FUNCTION public.ledger_vat_registered_set(uuid, boolean, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ledger_vat_registered_set(uuid, boolean, date) TO authenticated, service_role;

-- 6. Backfill: Yes for open companies with any sign of VAT registration; every other company stays No.
INSERT INTO public.ledger_auto_settings AS cur (organization_id, vat_registered, updated_at)
SELECT o.id, true, now() FROM public.organizations o
 WHERE o.closed_at IS NULL AND (
       EXISTS (SELECT 1 FROM public.hmrc_connections h WHERE h.company_id = o.id)
    OR EXISTS (SELECT 1 FROM public.hmrc_settings s WHERE s.organization_id = o.id AND NULLIF(btrim(s.vat_number), '') IS NOT NULL)
    OR EXISTS (SELECT 1 FROM public.invoices i WHERE i.organization_id = o.id AND i.vat_status = 'recorded' AND i.tax_amount > 0)
    OR EXISTS (SELECT 1 FROM public.bills b WHERE b.organization_id = o.id AND b.vat_status = 'recorded' AND b.vat_amount > 0)
    OR EXISTS (SELECT 1 FROM public.expenses e WHERE e.organization_id = o.id AND e.vat_status = 'recorded' AND e.vat_amount > 0))
ON CONFLICT (organization_id) DO UPDATE SET vat_registered = true, updated_at = now();

DO $$
BEGIN
  IF has_function_privilege('anon', 'public.ledger_vat_registered_set(uuid,boolean,date)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.ledger_vat_registered_set(uuid,boolean,date)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public._ledger_auto_vat_registered(uuid,date)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public._ledger_auto_bill_plan(uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'privileges are not as intended';
  END IF;
END $$;

COMMIT;

-- How many open companies each backfill rule would set to Yes (read only; run it before applying; not part of the change):
-- SELECT
--   (SELECT count(DISTINCT h.company_id) FROM public.hmrc_connections h JOIN public.organizations o ON o.id = h.company_id AND o.closed_at IS NULL) AS by_hmrc_connection,
--   (SELECT count(DISTINCT h.company_id) FROM public.hmrc_connections h JOIN public.organizations o ON o.id = h.company_id AND o.closed_at IS NULL
--      WHERE h.environment = 'production') AS of_which_production,
--   (SELECT count(DISTINCT s.organization_id) FROM public.hmrc_settings s JOIN public.organizations o ON o.id = s.organization_id AND o.closed_at IS NULL
--      WHERE NULLIF(btrim(s.vat_number), '') IS NOT NULL) AS by_vat_number,
--   (SELECT count(DISTINCT x.org) FROM (SELECT organization_id AS org FROM public.invoices WHERE vat_status = 'recorded' AND tax_amount > 0
--      UNION SELECT organization_id FROM public.bills WHERE vat_status = 'recorded' AND vat_amount > 0
--      UNION SELECT organization_id FROM public.expenses WHERE vat_status = 'recorded' AND vat_amount > 0) x
--      JOIN public.organizations o ON o.id = x.org AND o.closed_at IS NULL) AS by_recorded_vat,
--   (SELECT count(*) FROM public.organizations o WHERE o.closed_at IS NULL AND (
--      EXISTS (SELECT 1 FROM public.hmrc_connections h WHERE h.company_id = o.id)
--      OR EXISTS (SELECT 1 FROM public.hmrc_settings s WHERE s.organization_id = o.id AND NULLIF(btrim(s.vat_number), '') IS NOT NULL)
--      OR EXISTS (SELECT 1 FROM public.invoices i WHERE i.organization_id = o.id AND i.vat_status = 'recorded' AND i.tax_amount > 0)
--      OR EXISTS (SELECT 1 FROM public.bills b WHERE b.organization_id = o.id AND b.vat_status = 'recorded' AND b.vat_amount > 0)
--      OR EXISTS (SELECT 1 FROM public.expenses e WHERE e.organization_id = o.id AND e.vat_status = 'recorded' AND e.vat_amount > 0))) AS total_set_to_yes,
--   (SELECT count(*) FROM public.organizations WHERE closed_at IS NULL) AS open_companies;
