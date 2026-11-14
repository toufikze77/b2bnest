-- =====================================================================================================================
-- Finance phase 3b: automatic ledger postings for bills and expenses. PREPARED, NOT APPLIED.
-- Read docs/ledger-auto-bills/README.md first. One transaction. It extends the phase 3a engine (docs/ledger-auto); it
-- does not fork it: the same queue, posting links, needs-attention rows, journal writer, runner, preview, catch-up and run.
--
-- Changes to existing objects (the only ones):
--  * CHECKs: journal_entries.je_source_type (+ auto_bill, auto_bill_payment, auto_expense); ledger_post_queue
--    .lpq_source_table, ledger_postings.lp_source_table / lp_kind, ledger_post_issues.lpi_source_table / lpi_kind /
--    lpi_reason (+ bills, expenses; + bill_received, bill_paid, expense; + four reasons, see below).
--  * ledger_auto_settings: one new column bills_enabled boolean NOT NULL DEFAULT false (one switch for bills and expenses).
--  * CREATE OR REPLACE (same signatures): ledger_process_queue, ledger_auto_status, ledger_auto_set(uuid,boolean),
--    ledger_auto_preview, ledger_auto_run. Unchanged and still used: _ledger_auto_apply, _ledger_auto_plan,
--    _ledger_auto_journal, _ledger_auto_issue, _ledger_auto_pence, _ledger_auto_history_guard,
--    _ledger_auto_invoice_changed, ledger_auto_catch_up(uuid). _ledger_auto_org_ready stays in place, no longer called.
-- New: table ledger_category_map; triggers ledger_auto_record on bills and expenses (queue only, never fail the save);
--  plan functions for bills and expenses, one applier for both, overloads ledger_auto_set(uuid,boolean,text) and
--  ledger_auto_catch_up(uuid,text).
--
-- Production facts (14 Nov 2026, from the owner's assistant and the repository): 156 tables in public (md5 of the sorted
-- names 78b3091d6049d5a502c5ee819a502465), the CHECK definitions below, the bills and expenses column types below,
-- profiles.currency_code text, and md5(prosrc) of the 3a functions as production stores them. Production keeps some
-- bodies without comments: a body is accepted raw, without its whole-line comments, or without any '--' comment.
-- THE OWNER'S ASSISTANT RE-VERIFIES THESE BEFORE APPLYING; anything else: refused.
-- Rollback: docs/ledger-auto-bills/rollback.sql (refuses while any bill or expense posting exists).
-- Tests: docs/ledger-auto-bills/run-test.sh.
-- =====================================================================================================================
BEGIN;

DO $$
DECLARE r record; v text;
BEGIN
  IF to_regclass('public.ledger_category_map') IS NOT NULL
     OR EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.ledger_auto_settings'::regclass AND attname = 'bills_enabled' AND NOT attisdropped) THEN
    RAISE EXCEPTION 'Finance phase 3b bill and expense postings already exist (applied twice?)';
  END IF;
  IF (SELECT md5(string_agg(relname, ',' ORDER BY relname)) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind IN ('r', 'p'))
     IS DISTINCT FROM '78b3091d6049d5a502c5ee819a502465' THEN
    RAISE EXCEPTION 'the tables in public differ from production as read on 14 Nov 2026';
  END IF;
  -- Each body as production stores it; the live body is compared raw, without whole-line comments, and without any comment.
  FOR r IN SELECT fn, array_agg(h) AS hs FROM (VALUES
      ('public._ledger_auto_apply(uuid,uuid)', '49726ce6f5b6da95529dc00dfd4e10fa'),
      ('public._ledger_auto_history_guard()', 'b8de1a80e1075d31037ded215c7f91de'),
      ('public._ledger_auto_invoice_changed()', '89af0faa5a2fba2b8beee7fe93189e93'),
      ('public._ledger_auto_issue(uuid,uuid,text,text,text)', '6bf2dafbd1b555db99887c229b7bbc43'),
      ('public._ledger_auto_journal(uuid,date,text,text,uuid,uuid,jsonb,uuid)', '8d63e691bfa7262ee35339d43d718073'),
      ('public._ledger_auto_org_ready(uuid)', 'ddd68b637b5c6bced8ace7e1a2a2c78e'),
      ('public._ledger_auto_pence(numeric)', '7513a2bf798a91f8130832431b954709'),
      ('public._ledger_auto_plan(uuid,uuid)', '0832f99e94d54cad15d380145df2d628'),
      ('public.ledger_auto_catch_up(uuid)', 'f96e7a5ff5a7623c5ae41240152d07b2'),
      ('public.ledger_auto_preview(uuid)', 'fe2ea1440edcdb94f5f0667072102eaf'),
      ('public.ledger_auto_run(uuid)', '945d444f5a1fc50ee4e62bd4d6cd953e'),
      ('public.ledger_auto_set(uuid,boolean)', 'bed001b9a0fa96340b819171f2adcb60'),
      ('public.ledger_auto_status(uuid)', '8c94bfd9c512b5ff15e51320f4cfc07f'),
      ('public.ledger_process_queue(uuid,integer)', '4450dc44310f6c034607e8e3a4ececdf'),
      ('public._ledger_rule(uuid,uuid)', 'edf2117e8b0bdeb3826552b712faa227'),
      ('public._ledger_org_open(uuid)', '361077573d6cc7f9c83c6702808d61cd'),
      ('public._ledger_require_writer(uuid)', '75ecf4a981581daae33e90dc554f01c4'),
      ('public._ledger_append_only()', 'f47e341b7cca2f0118e8e70493984e56'),
      ('public._ledger_entry_guard()', '727748e665991e8105a96e15f7f9929c'),
      ('public._ledger_balance_check()', 'ee84f8fd18cb93fcd9fa1dfbd6aa36e7'),
      ('public.ledger_reverse_journal(uuid,text,date)', '22157acb97b8b8cb3ade3318177353b9'),
      ('public.require_aal2_if_enrolled()', '10b2ae7bd2f9a94ea20598f19b8aebf2'),
      ('public.user_is_organization_member(uuid,uuid)', '1fb55538d44b2451875f8baf1b6e4388'),
      ('public.demo_readonly_guard()', '087b5fe2695b95b8ba2ba6eb195ba995'),
      ('public._data_rights_gate_is_open(text)', 'b22b22eda6bd86e8ff363a6a58bfe3a3'),
      ('public._data_rights_closed_company_guard()', '2ec2d8630e284aed65d010c61a442a53'),
      ('public._data_rights_company_tables()', 'c4497fd5fa0245618d1168f9c19bffe1'),
      ('public._ledger_line_guard()', '1c805547e284b65803d2f9bbb480d761'), ('public._ledger_line_guard()', '041398b1d1ecbd5856c7cab85aff8479'),
      ('public.mfa_ok()', '20516f2ec203220b3ac08d1230c7c306'), ('public.mfa_ok()', 'c6fd9b98a36055f056bbd682cb57f3aa'),
      ('public.hmrc_manage_allowed(uuid,uuid)', '9304f069f05402aab62d343b3626cd65'), ('public.hmrc_manage_allowed(uuid,uuid)', '801908512427b85279c33bfffd64922e'),
      ('public._data_rights_close_org(uuid,uuid)', 'b0c5e82fc596390a6275b53524947531'), ('public._data_rights_close_org(uuid,uuid)', '6c379a1d11b0e469c13ec57e4f054678'),
      ('public.data_rights_delete_account(uuid,uuid,boolean)', 'b1922b7985b959d094e72248019551fa'),
      ('public.data_rights_delete_account(uuid,uuid,boolean)', '4492cbbb945bbe7a7f72b83b249bcaef')) x(fn, h) GROUP BY fn LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc p, LATERAL (SELECT regexp_replace(p.prosrc, E'\\n[ \\t]*--[^\\n]*', '', 'g') AS lines) c
                    WHERE p.oid = to_regprocedure(r.fn)
                      AND (md5(p.prosrc) = ANY (r.hs) OR md5(c.lines) = ANY (r.hs) OR md5(regexp_replace(c.lines, E'[ \\t]*--[^\\n]*', '', 'g')) = ANY (r.hs))) THEN
      RAISE EXCEPTION '% differs from the body this was written against (or is missing)', r.fn;
    END IF;
  END LOOP;
  FOR r IN SELECT * FROM (VALUES
      ('journal_entries', 'je_source_type', 'CHECK ((source_type = ANY (ARRAY[''manual''::text, ''opening_balance''::text, ''reversal''::text, ''auto_invoice''::text, ''auto_invoice_payment''::text])))'),
      ('ledger_post_queue', 'lpq_source_table', 'CHECK ((source_table = ''invoices''::text))'),
      ('ledger_postings', 'lp_source_table', 'CHECK ((source_table = ''invoices''::text))'),
      ('ledger_postings', 'lp_kind', 'CHECK ((kind = ANY (ARRAY[''invoice_issued''::text, ''invoice_paid''::text])))'),
      ('ledger_post_issues', 'lpi_source_table', 'CHECK ((source_table = ''invoices''::text))'),
      ('ledger_post_issues', 'lpi_kind', 'CHECK ((kind = ANY (ARRAY[''invoice_issued''::text, ''invoice_paid''::text])))'),
      ('ledger_post_issues', 'lpi_reason', 'CHECK ((reason_code = ANY (ARRAY[''before_start''::text, ''period_locked''::text, ''amounts_do_not_add_up''::text, ''amounts_missing''::text, ''not_whole_pence''::text, ''zero_total''::text, ''negative_amount''::text, ''currency_not_gbp''::text, ''paid_date_missing''::text, ''issue_not_posted''::text, ''reversal_period_locked''::text, ''processing_failed''::text])))')) c(t, n, d) LOOP
    SELECT pg_get_constraintdef(k.oid) INTO v FROM pg_constraint k WHERE k.conrelid = ('public.' || r.t)::regclass AND k.conname = r.n;
    IF v IS DISTINCT FROM r.d THEN RAISE EXCEPTION '%.% differs from phase 3a (%)', r.t, r.n, v; END IF;
  END LOOP;
  SELECT string_agg(attname || ':' || format_type(atttypid, atttypmod), ',' ORDER BY attname) INTO v FROM pg_attribute
   WHERE attrelid = 'public.bills'::regclass AND NOT attisdropped
     AND attname IN ('id', 'organization_id', 'user_id', 'bill_number', 'vendor_name', 'category', 'amount', 'net_amount', 'vat_amount', 'vat_reclaimable',
                     'vat_status', 'currency', 'issue_date', 'paid_date', 'tax_point_date', 'status');
  IF v IS DISTINCT FROM 'amount:numeric,bill_number:text,category:text,currency:text,id:uuid,issue_date:date,net_amount:numeric(12,2),organization_id:uuid,'
                     || 'paid_date:date,status:text,tax_point_date:date,user_id:uuid,vat_amount:numeric(12,2),vat_reclaimable:boolean,vat_status:text,vendor_name:text' THEN
    RAISE EXCEPTION 'bills columns differ (%)', v;
  END IF;
  SELECT string_agg(attname || ':' || format_type(atttypid, atttypmod), ',' ORDER BY attname) INTO v FROM pg_attribute
   WHERE attrelid = 'public.expenses'::regclass AND NOT attisdropped
     AND attname IN ('id', 'organization_id', 'user_id', 'category', 'date', 'amount', 'net_amount', 'vat_amount', 'vat_reclaimable', 'vat_status', 'status', 'tax_point_date');
  IF v IS DISTINCT FROM 'amount:numeric(10,2),category:text,date:date,id:uuid,net_amount:numeric(12,2),organization_id:uuid,status:text,tax_point_date:date,'
                     || 'user_id:uuid,vat_amount:numeric(12,2),vat_reclaimable:boolean,vat_status:text' THEN
    RAISE EXCEPTION 'expenses columns differ (%)', v;
  END IF;
  IF (SELECT format_type(atttypid, atttypmod) FROM pg_attribute WHERE attrelid = 'public.profiles'::regclass AND attname = 'currency_code' AND NOT attisdropped) IS DISTINCT FROM 'text' THEN
    RAISE EXCEPTION 'profiles.currency_code differs';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'ledger_auto_record' AND tgrelid IN ('public.bills'::regclass, 'public.expenses'::regclass)) THEN
    RAISE EXCEPTION 'bills or expenses already has a ledger_auto_record trigger';
  END IF;
END $$;

-- 1. The CHECK changes and the one new column.
ALTER TABLE public.journal_entries DROP CONSTRAINT je_source_type;
ALTER TABLE public.journal_entries ADD CONSTRAINT je_source_type
  CHECK (source_type IN ('manual', 'opening_balance', 'reversal', 'auto_invoice', 'auto_invoice_payment', 'auto_bill', 'auto_bill_payment', 'auto_expense'));
ALTER TABLE public.ledger_post_queue DROP CONSTRAINT lpq_source_table;
ALTER TABLE public.ledger_post_queue ADD CONSTRAINT lpq_source_table CHECK (source_table IN ('invoices', 'bills', 'expenses'));
ALTER TABLE public.ledger_postings DROP CONSTRAINT lp_source_table, DROP CONSTRAINT lp_kind;
ALTER TABLE public.ledger_postings ADD CONSTRAINT lp_source_table CHECK (source_table IN ('invoices', 'bills', 'expenses')),
  ADD CONSTRAINT lp_kind CHECK (kind IN ('invoice_issued', 'invoice_paid', 'bill_received', 'bill_paid', 'expense'));
ALTER TABLE public.ledger_post_issues DROP CONSTRAINT lpi_source_table, DROP CONSTRAINT lpi_kind, DROP CONSTRAINT lpi_reason;
ALTER TABLE public.ledger_post_issues ADD CONSTRAINT lpi_source_table CHECK (source_table IN ('invoices', 'bills', 'expenses')),
  ADD CONSTRAINT lpi_kind CHECK (kind IN ('invoice_issued', 'invoice_paid', 'bill_received', 'bill_paid', 'expense')),
  ADD CONSTRAINT lpi_reason CHECK (reason_code IN ('before_start', 'period_locked', 'amounts_do_not_add_up', 'amounts_missing',
    'not_whole_pence', 'zero_total', 'negative_amount', 'currency_not_gbp', 'paid_date_missing', 'issue_not_posted', 'reversal_period_locked', 'processing_failed',
    'vat_details_missing', 'category_not_mapped', 'category_account_missing', 'category_account_inactive'));
ALTER TABLE public.ledger_auto_settings ADD COLUMN bills_enabled boolean NOT NULL DEFAULT false;

-- 2. The category map: which expense account each bill and expense category posts to, per company. Seeded with the
--    standard chart's codes when bills and expenses are switched on; editable later (not in this PR). A category that
--    isn't in the map, or whose account was deleted or made inactive, goes to "needs attention": nothing is guessed.
CREATE TABLE public.ledger_category_map (
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  category_key text NOT NULL CONSTRAINT lcm_key CHECK (category_key ~ '^[a-z0-9_]{1,60}$'),
  account_id uuid REFERENCES public.ledger_accounts(id) ON DELETE SET NULL,
  is_default boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, category_key)
);
COMMENT ON TABLE public.ledger_category_map IS 'Finance phase 3b: per company, the ledger account each bill or expense category posts to (category_key = the category, lower case, words joined by _). Written only by the ledger functions.';
CREATE TRIGGER data_rights_closed_company BEFORE INSERT OR UPDATE ON public.ledger_category_map FOR EACH ROW EXECUTE FUNCTION public._data_rights_closed_company_guard('organization_id');
CREATE TRIGGER a0_demo_readonly_guard BEFORE INSERT OR UPDATE OR DELETE ON public.ledger_category_map FOR EACH ROW EXECUTE FUNCTION public.demo_readonly_guard();
ALTER TABLE public.ledger_category_map ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ledger_category_map FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.ledger_category_map TO authenticated, service_role;
CREATE POLICY "Company members can read the category map" ON public.ledger_category_map FOR SELECT TO authenticated
  USING (public.user_is_organization_member(organization_id, (SELECT auth.uid())));
CREATE POLICY require_aal2_if_enrolled ON public.ledger_category_map AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY ledger_hide_closed ON public.ledger_category_map AS RESTRICTIVE FOR SELECT TO authenticated USING (public._ledger_org_open(organization_id));

-- "Software and subscriptions" -> software_and_subscriptions; "office_costs" stays office_costs.
CREATE FUNCTION public._ledger_auto_category_key(p_category text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  SELECT left(btrim(regexp_replace(lower(btrim(COALESCE(p_category, ''))), '[^a-z0-9]+', '_', 'g'), '_'), 60);
$function$;

-- The standard mapping (codes of the standard chart, docs/ledger/proposal.sql). Categories with no matching account in
-- the standard chart go to 8200 Other overheads only where they are plainly overheads; anything else (for example
-- Equipment, which may be a fixed asset) is left out on purpose, so it needs attention instead of being guessed.
CREATE FUNCTION public._ledger_auto_default_categories()
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

-- Seeds the standard mapping for a company (missing keys only; nothing already there is changed).
CREATE FUNCTION public._ledger_auto_seed_category_map(p_org uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_n integer;
BEGIN
  INSERT INTO public.ledger_category_map (organization_id, category_key, account_id, is_default)
  SELECT p_org, d.category_key,
         (SELECT a.id FROM public.ledger_accounts a WHERE a.organization_id = p_org
             AND ((d.system_key IS NOT NULL AND a.system_key = d.system_key) OR (d.system_key IS NULL AND a.code = d.code)) LIMIT 1), true
    FROM public._ledger_auto_default_categories() d
  ON CONFLICT (organization_id, category_key) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$function$;

-- The account for a category: {account_id} or {reason}. Before the company's map is seeded (preview before switching
-- on), the standard mapping is used, read only.
CREATE FUNCTION public._ledger_auto_category_account(p_org uuid, p_category text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_key text := public._ledger_auto_category_key(p_category); m public.ledger_category_map; a public.ledger_accounts; v_found boolean := false;
BEGIN
  SELECT * INTO m FROM public.ledger_category_map WHERE organization_id = p_org AND category_key = v_key;
  IF FOUND THEN
    v_found := true;
  ELSIF NOT EXISTS (SELECT 1 FROM public.ledger_category_map WHERE organization_id = p_org) THEN
    SELECT p_org, d.category_key,
           (SELECT x.id FROM public.ledger_accounts x WHERE x.organization_id = p_org
               AND ((d.system_key IS NOT NULL AND x.system_key = d.system_key) OR (d.system_key IS NULL AND x.code = d.code)) LIMIT 1)
      INTO m.organization_id, m.category_key, m.account_id
      FROM public._ledger_auto_default_categories() d WHERE d.category_key = v_key;
    v_found := FOUND;
  END IF;
  IF NOT v_found THEN RETURN jsonb_build_object('reason', 'category_not_mapped'); END IF;
  IF m.account_id IS NULL THEN RETURN jsonb_build_object('reason', 'category_account_missing'); END IF;
  SELECT * INTO a FROM public.ledger_accounts WHERE id = m.account_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('reason', 'category_account_missing'); END IF;
  IF NOT a.is_active THEN RETURN jsonb_build_object('reason', 'category_account_inactive'); END IF;
  RETURN jsonb_build_object('account_id', a.id);
END;
$function$;

-- One automatic journal to post, or why not: the shape shared by the bill and expense plans and the applier.
CREATE FUNCTION public._ledger_auto_want(p_reason text, p_date date, p_memo text, p_source_type text, p_lines jsonb, p_total bigint,
                                         p_hash text, p_requires text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  SELECT CASE WHEN p_reason IS NOT NULL THEN jsonb_build_object('want', false, 'reason', p_reason, 'date', p_date, 'total', p_total)
              ELSE jsonb_build_object('want', true, 'date', p_date, 'memo', left(p_memo, 200), 'source_type', p_source_type, 'total', p_total, 'hash', p_hash,
                     'requires', p_requires,
                     'lines', (SELECT COALESCE(jsonb_agg(l), '[]'::jsonb) FROM jsonb_array_elements(p_lines) l
                                WHERE (l ->> 'debit')::bigint > 0 OR (l ->> 'credit')::bigint > 0)) END;
$function$;

-- 3. The bill plan (docs/ledger-auto-bills/README.md): received (Dr expense = net [+ VAT if not reclaimable], Dr VAT
--    control = reclaimable VAT, Cr Creditors = gross) and paid (Dr Creditors, Cr Bank). Whole pence; nothing guessed.
CREATE FUNCTION public._ledger_auto_bill_plan(p_org uuid, p_bill uuid)
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

-- 4. The expense plan: approved or paid expenses (money already spent): Dr expense = net [+ VAT if not reclaimable],
--    Dr VAT control = reclaimable VAT, Cr Bank = gross. Pending, rejected and anything else: nothing.
--    Expenses have no currency column: GBP when the owner's account currency is GBP (as the VAT return, HMRC P5).
CREATE FUNCTION public._ledger_auto_expense_plan(p_org uuid, p_expense uuid)
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

-- The plan of a bill or an expense.
CREATE FUNCTION public._ledger_auto_record_plan(p_org uuid, p_table text, p_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT CASE p_table WHEN 'bills' THEN public._ledger_auto_bill_plan(p_org, p_id) WHEN 'expenses' THEN public._ledger_auto_expense_plan(p_org, p_id) END;
$function$;

-- Opens (or keeps) the one open issue for a record and kind; p_reason NULL resolves it. (The 3a _ledger_auto_issue
-- is for invoices and stays as it is.)
CREATE FUNCTION public._ledger_auto_flag(p_org uuid, p_table text, p_id uuid, p_label text, p_kind text, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_open public.ledger_post_issues;
BEGIN
  SELECT * INTO v_open FROM public.ledger_post_issues WHERE organization_id = p_org AND source_table = p_table AND source_id = p_id AND kind = p_kind AND resolved_at IS NULL;
  IF FOUND AND v_open.reason_code IS NOT DISTINCT FROM p_reason THEN RETURN; END IF;
  IF FOUND THEN UPDATE public.ledger_post_issues SET resolved_at = now() WHERE id = v_open.id; END IF;
  IF p_reason IS NOT NULL THEN
    INSERT INTO public.ledger_post_issues (organization_id, source_table, source_id, source_label, kind, reason_code)
    VALUES (p_org, p_table, p_id, p_label, p_kind, p_reason);
  END IF;
END;
$function$;

-- 5. One applier for bills and expenses, the same steps as the 3a invoice applier: reverse what no longer matches
--    (later kinds first), then post what is missing (in order), recording or resolving needs attention. Idempotent,
--    under the same per-company advisory lock. A journal reversed by hand is not posted again for the same version.
CREATE FUNCTION public._ledger_auto_apply_record(p_org uuid, p_table text, p_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_plan jsonb; v_kinds text[]; v_k text; v_want jsonb; l public.ledger_postings; e public.journal_entries; s public.ledger_settings;
  v_rev uuid; v_date date; v_lines jsonb; v_entry uuid; v_posted integer := 0; v_blocked boolean := false; v_label text; i integer;
BEGIN
  IF p_table NOT IN ('bills', 'expenses') THEN RAISE EXCEPTION 'LEDGER_BAD_SOURCE' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('ledger:' || p_org::text, 0));
  SELECT * INTO s FROM public.ledger_settings WHERE organization_id = p_org;
  IF NOT FOUND THEN RETURN 0; END IF;
  v_plan := public._ledger_auto_record_plan(p_org, p_table, p_id);
  v_label := v_plan ->> 'label';
  v_kinds := CASE p_table WHEN 'bills' THEN ARRAY['bill_received', 'bill_paid'] ELSE ARRAY['expense'] END;
  -- 1. Reverse what no longer matches, the last kind first (a payment before its bill).
  FOR i IN REVERSE cardinality(v_kinds)..1 LOOP
    v_k := v_kinds[i];
    v_want := v_plan -> 'kinds' -> v_k;
    SELECT * INTO l FROM public.ledger_postings WHERE organization_id = p_org AND source_table = p_table AND source_id = p_id AND kind = v_k AND reversed_at IS NULL;
    CONTINUE WHEN NOT FOUND;
    v_label := COALESCE(v_label, l.source_label);
    SELECT r.id INTO v_rev FROM public.journal_entries r WHERE r.reverses_entry_id = l.entry_id;
    IF v_rev IS NOT NULL THEN
      UPDATE public.ledger_postings SET reversal_entry_id = v_rev, reversed_how = 'by_hand', reversed_at = now() WHERE id = l.id;
      CONTINUE;
    END IF;
    CONTINUE WHEN (v_want ->> 'want')::boolean AND v_want ->> 'hash' = l.version_hash;
    SELECT * INTO e FROM public.journal_entries WHERE id = l.entry_id;
    v_date := CASE WHEN s.locked_through IS NULL OR e.entry_date > s.locked_through THEN e.entry_date ELSE current_date END;
    IF s.locked_through IS NOT NULL AND v_date <= s.locked_through THEN
      v_blocked := true;
      PERFORM public._ledger_auto_flag(p_org, p_table, p_id, v_label, v_k, 'reversal_period_locked');
      CONTINUE;
    END IF;
    SELECT jsonb_agg(jsonb_build_object('account_id', jl.account_id, 'debit', public._ledger_auto_pence(jl.credit), 'credit', public._ledger_auto_pence(jl.debit)) ORDER BY jl.line_no)
      INTO v_lines FROM public.journal_lines jl WHERE jl.entry_id = e.id;
    v_rev := public._ledger_auto_journal(p_org, v_date, 'Reversal: ' || e.memo, 'reversal', e.source_id, e.posted_by, v_lines, e.id);
    UPDATE public.ledger_postings SET reversal_entry_id = v_rev, reversed_how = 'automatic', reversed_at = now() WHERE id = l.id;
    v_posted := v_posted + 1;
  END LOOP;
  IF v_blocked THEN RETURN v_posted; END IF;
  -- 2. Post what is missing, in order (a bill before its payment).
  FOREACH v_k IN ARRAY v_kinds LOOP
    v_want := v_plan -> 'kinds' -> v_k;
    IF NOT (v_want ->> 'want')::boolean THEN
      PERFORM public._ledger_auto_flag(p_org, p_table, p_id, v_label, v_k, v_want ->> 'reason');
      CONTINUE;
    END IF;
    CONTINUE WHEN EXISTS (SELECT 1 FROM public.ledger_postings WHERE organization_id = p_org AND source_table = p_table AND source_id = p_id AND kind = v_k AND reversed_at IS NULL);
    IF EXISTS (SELECT 1 FROM public.ledger_postings WHERE organization_id = p_org AND source_table = p_table AND source_id = p_id AND kind = v_k
                 AND version_hash = v_want ->> 'hash' AND reversed_how = 'by_hand') THEN
      PERFORM public._ledger_auto_flag(p_org, p_table, p_id, v_label, v_k, NULL);
      CONTINUE;
    END IF;
    IF v_want ->> 'requires' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.ledger_postings WHERE organization_id = p_org AND source_table = p_table
                                                          AND source_id = p_id AND kind = v_want ->> 'requires' AND reversed_at IS NULL) THEN
      PERFORM public._ledger_auto_flag(p_org, p_table, p_id, v_label, v_k, 'issue_not_posted');
      CONTINUE;
    END IF;
    v_entry := public._ledger_auto_journal(p_org, (v_want ->> 'date')::date, v_want ->> 'memo', v_want ->> 'source_type', p_id, (v_plan ->> 'poster')::uuid, v_want -> 'lines');
    INSERT INTO public.ledger_postings (organization_id, source_table, source_id, source_label, kind, version_hash, entry_id)
    VALUES (p_org, p_table, p_id, v_label, v_k, v_want ->> 'hash', v_entry);
    PERFORM public._ledger_auto_flag(p_org, p_table, p_id, v_label, v_k, NULL);
    v_posted := v_posted + 1;
  END LOOP;
  RETURN v_posted;
END;
$function$;

-- A company and source whose automatic postings may run: open, set up, that switch on, and an active owner or admin
-- whose plan includes the ledger. (The 3a _ledger_auto_org_ready is the invoices case and stays as it was.)
CREATE FUNCTION public._ledger_auto_source_ready(p_org uuid, p_table text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT public._ledger_org_open(p_org)
     AND EXISTS (SELECT 1 FROM public.ledger_settings s WHERE s.organization_id = p_org)
     AND EXISTS (SELECT 1 FROM public.ledger_auto_settings a WHERE a.organization_id = p_org
                  AND CASE WHEN p_table = 'invoices' THEN a.invoices_enabled ELSE a.bills_enabled END)
     AND EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id = p_org AND m.is_active AND public._ledger_rule(p_org, m.user_id) = 'ok');
$function$;

-- 6. The bill and expense trigger: never fails the save, never posts; one queue row per company that switched bills
--    and expenses on, only when a field the ledger uses changed. (Invoices keep their own 3a trigger.)
CREATE FUNCTION public._ledger_auto_record_changed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_new jsonb; v_old jsonb; v_keys text[]; v_orgs uuid[]; v_id uuid; v_org uuid;
BEGIN
  BEGIN
    IF public._data_rights_gate_is_open('company_close') THEN RETURN NULL; END IF;
    IF TG_OP <> 'DELETE' THEN v_new := to_jsonb(NEW); END IF;
    IF TG_OP <> 'INSERT' THEN v_old := to_jsonb(OLD); END IF;
    v_keys := CASE TG_TABLE_NAME
      WHEN 'bills' THEN ARRAY['id', 'organization_id', 'status', 'paid_date', 'amount', 'net_amount', 'vat_amount', 'vat_reclaimable', 'vat_status',
                              'currency', 'tax_point_date', 'issue_date', 'bill_number', 'vendor_name', 'category']
      ELSE ARRAY['id', 'organization_id', 'user_id', 'status', 'amount', 'net_amount', 'vat_amount', 'vat_reclaimable', 'vat_status',
                 'tax_point_date', 'date', 'category'] END;
    IF TG_OP = 'UPDATE' AND (SELECT jsonb_object_agg(k, v_new -> k) FROM unnest(v_keys) k) IS NOT DISTINCT FROM (SELECT jsonb_object_agg(k, v_old -> k) FROM unnest(v_keys) k) THEN
      RETURN NULL;
    END IF;
    v_id := COALESCE(v_new ->> 'id', v_old ->> 'id')::uuid;
    v_orgs := ARRAY[(v_new ->> 'organization_id')::uuid, (v_old ->> 'organization_id')::uuid];
    FOR v_org IN SELECT DISTINCT x FROM unnest(v_orgs) x WHERE x IS NOT NULL LOOP
      IF EXISTS (SELECT 1 FROM public.ledger_auto_settings s WHERE s.organization_id = v_org AND s.bills_enabled) THEN
        INSERT INTO public.ledger_post_queue (organization_id, source_table, source_id) VALUES (v_org, TG_TABLE_NAME, v_id);
      END IF;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NULL;
END;
$function$;
CREATE TRIGGER ledger_auto_record AFTER INSERT OR UPDATE OR DELETE ON public.bills FOR EACH ROW EXECUTE FUNCTION public._ledger_auto_record_changed();
CREATE TRIGGER ledger_auto_record AFTER INSERT OR UPDATE OR DELETE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public._ledger_auto_record_changed();

-- 7. The runner (replaced): the same rules as 3a, now per source: invoices through the 3a applier, bills and expenses
--    through the new one. A source that isn't ready loses its waiting rows. After 5 failed tries: needs attention.
CREATE OR REPLACE FUNCTION public.ledger_process_queue(p_org uuid DEFAULT NULL, p_limit integer DEFAULT 200)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE q record; v_processed integer := 0; v_failed integer := 0; v_dropped integer := 0; v_n integer; v_state text; v_label text;
BEGIN
  p_limit := LEAST(GREATEST(COALESCE(p_limit, 200), 1), 200);
  WITH gone AS (
    DELETE FROM public.ledger_post_queue q2 WHERE (p_org IS NULL OR q2.organization_id = p_org)
       AND NOT public._ledger_auto_source_ready(q2.organization_id, q2.source_table) RETURNING 1)
  SELECT count(*) INTO v_dropped FROM gone;
  FOR q IN SELECT q3.organization_id, q3.source_table, q3.source_id, max(q3.id) AS last_id, max(q3.attempts) AS attempts
             FROM public.ledger_post_queue q3 WHERE p_org IS NULL OR q3.organization_id = p_org
            GROUP BY q3.organization_id, q3.source_table, q3.source_id ORDER BY min(q3.id) LIMIT p_limit LOOP
    BEGIN
      IF q.source_table = 'invoices' THEN
        PERFORM public._ledger_auto_apply(q.organization_id, q.source_id);
      ELSE
        PERFORM public._ledger_auto_apply_record(q.organization_id, q.source_table, q.source_id);
      END IF;
      DELETE FROM public.ledger_post_queue WHERE organization_id = q.organization_id AND source_table = q.source_table AND source_id = q.source_id AND id <= q.last_id;
      v_processed := v_processed + 1;
    EXCEPTION WHEN OTHERS THEN
      v_state := SQLSTATE;
      v_failed := v_failed + 1;
      IF q.attempts + 1 >= 5 THEN
        DELETE FROM public.ledger_post_queue WHERE organization_id = q.organization_id AND source_table = q.source_table AND source_id = q.source_id AND id <= q.last_id;
        BEGIN
          IF q.source_table = 'invoices' THEN
            SELECT left(i.invoice_number, 120) INTO v_label FROM public.invoices i WHERE i.id = q.source_id;
            PERFORM public._ledger_auto_issue(q.organization_id, q.source_id, v_label, 'invoice_issued', 'processing_failed');
          ELSE
            v_label := public._ledger_auto_record_plan(q.organization_id, q.source_table, q.source_id) ->> 'label';
            PERFORM public._ledger_auto_flag(q.organization_id, q.source_table, q.source_id, v_label,
              CASE q.source_table WHEN 'bills' THEN 'bill_received' ELSE 'expense' END, 'processing_failed');
          END IF;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
      ELSE
        UPDATE public.ledger_post_queue SET attempts = q.attempts + 1, last_error = v_state
         WHERE organization_id = q.organization_id AND source_table = q.source_table AND source_id = q.source_id AND id <= q.last_id;
      END IF;
    END;
  END LOOP;
  SELECT count(DISTINCT (organization_id, source_table, source_id)) INTO v_n FROM public.ledger_post_queue WHERE p_org IS NULL OR organization_id = p_org;
  RETURN jsonb_build_object('processed', v_processed, 'failed', v_failed, 'dropped', v_dropped, 'remaining', v_n);
END;
$function$;

-- 8. What the screen calls.
-- Status (replaced): the 3a fields, plus bills_enabled. 'waiting' and 'open_issues' cover every source.
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

-- The switch for one source: 'invoices' (as 3a) or 'bills_and_expenses'. Off stops new postings for that source and
-- clears its waiting rows; it never deletes or reverses a journal. One audit row when the state changes.
CREATE FUNCTION public.ledger_auto_set(p_org uuid, p_enabled boolean, p_switch text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_was boolean; v_bills boolean := p_switch = 'bills_and_expenses';
BEGIN
  PERFORM public._ledger_require_writer(p_org);
  IF p_enabled IS NULL OR p_switch IS NULL OR p_switch NOT IN ('invoices', 'bills_and_expenses') THEN RAISE EXCEPTION 'LEDGER_BAD_REQUEST' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ledger_settings s WHERE s.organization_id = p_org) THEN RAISE EXCEPTION 'LEDGER_NOT_SET_UP' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('ledger:' || p_org::text, 0));
  SELECT CASE WHEN v_bills THEN bills_enabled ELSE invoices_enabled END INTO v_was FROM public.ledger_auto_settings WHERE organization_id = p_org;
  IF v_bills THEN
    INSERT INTO public.ledger_auto_settings AS cur (organization_id, bills_enabled, updated_at) VALUES (p_org, p_enabled, now())
    ON CONFLICT (organization_id) DO UPDATE SET bills_enabled = EXCLUDED.bills_enabled, updated_at = now();
    IF p_enabled THEN PERFORM public._ledger_auto_seed_category_map(p_org); END IF;
    IF NOT p_enabled THEN DELETE FROM public.ledger_post_queue WHERE organization_id = p_org AND source_table IN ('bills', 'expenses'); END IF;
  ELSE
    INSERT INTO public.ledger_auto_settings AS cur (organization_id, invoices_enabled, enabled_at, enabled_by, updated_at)
    VALUES (p_org, p_enabled, CASE WHEN p_enabled THEN now() END, CASE WHEN p_enabled THEN auth.uid() END, now())
    ON CONFLICT (organization_id) DO UPDATE SET invoices_enabled = EXCLUDED.invoices_enabled,
      enabled_at = CASE WHEN EXCLUDED.invoices_enabled AND NOT cur.invoices_enabled THEN now()
                        WHEN EXCLUDED.invoices_enabled THEN cur.enabled_at END,
      enabled_by = CASE WHEN EXCLUDED.invoices_enabled AND NOT cur.invoices_enabled THEN auth.uid()
                        WHEN EXCLUDED.invoices_enabled THEN cur.enabled_by END,
      updated_at = now();
    IF NOT p_enabled THEN DELETE FROM public.ledger_post_queue WHERE organization_id = p_org AND source_table = 'invoices'; END IF;
  END IF;
  IF COALESCE(v_was, false) IS DISTINCT FROM p_enabled THEN
    INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, details)
    VALUES (auth.uid(), 'ledger.auto_' || CASE WHEN v_bills THEN 'bills' ELSE 'invoices' END || CASE WHEN p_enabled THEN '_on' ELSE '_off' END,
            'ledger_auto_settings', p_org::text, jsonb_build_object('organization_id', p_org));
  END IF;
  RETURN public.ledger_auto_status(p_org);
END;
$function$;

-- The 3a two-argument switch is the invoices switch (replaced only so that switching invoices off clears invoice rows
-- only, now that bills and expenses share the queue).
CREATE OR REPLACE FUNCTION public.ledger_auto_set(p_org uuid, p_enabled boolean)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT public.ledger_auto_set(p_org, p_enabled, 'invoices');
$function$;

-- What posting existing bills and expenses would do now, without writing anything (whole pence).
CREATE FUNCTION public._ledger_auto_preview_records(p_org uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  r record; v_plan jsonb; v_k text; v_want jsonb; l public.ledger_postings; v_any boolean;
  v_bills integer := 0; v_bills_p bigint := 0; v_pays integer := 0; v_pays_p bigint := 0; v_exp integer := 0; v_exp_p bigint := 0;
  v_rev integer := 0; v_done integer := 0; v_none integer := 0; v_skip jsonb := '{}'::jsonb; v_reason text;
BEGIN
  FOR r IN SELECT 'bills'::text AS t, b.id FROM public.bills b WHERE b.organization_id = p_org
           UNION SELECT 'expenses', x.id FROM public.expenses x WHERE x.organization_id = p_org
           UNION SELECT p.source_table, p.source_id FROM public.ledger_postings p WHERE p.organization_id = p_org AND p.source_table IN ('bills', 'expenses') AND p.reversed_at IS NULL LOOP
    v_plan := public._ledger_auto_record_plan(p_org, r.t, r.id);
    v_any := false;
    FOR v_k IN SELECT jsonb_object_keys(v_plan -> 'kinds') LOOP
      v_want := v_plan -> 'kinds' -> v_k;
      SELECT * INTO l FROM public.ledger_postings p WHERE p.organization_id = p_org AND p.source_table = r.t AND p.source_id = r.id AND p.kind = v_k AND p.reversed_at IS NULL;
      IF FOUND THEN
        v_any := true;
        IF (v_want ->> 'want')::boolean AND v_want ->> 'hash' = l.version_hash THEN v_done := v_done + 1; CONTINUE; END IF;
        v_rev := v_rev + 1;
      END IF;
      IF (v_want ->> 'want')::boolean THEN
        v_any := true;
        IF v_k = 'bill_received' THEN v_bills := v_bills + 1; v_bills_p := v_bills_p + (v_want ->> 'total')::bigint;
        ELSIF v_k = 'bill_paid' THEN v_pays := v_pays + 1; v_pays_p := v_pays_p + (v_want ->> 'total')::bigint;
        ELSE v_exp := v_exp + 1; v_exp_p := v_exp_p + (v_want ->> 'total')::bigint; END IF;
      ELSIF v_want ->> 'reason' IS NOT NULL THEN
        v_any := true;
        v_reason := v_want ->> 'reason';
        v_skip := jsonb_set(v_skip, ARRAY[v_reason], to_jsonb(COALESCE((v_skip ->> v_reason)::integer, 0) + 1));
      END IF;
    END LOOP;
    IF NOT v_any THEN v_none := v_none + 1; END IF;
  END LOOP;
  RETURN jsonb_build_object('bills_to_post', v_bills, 'bills_total', v_bills_p, 'bill_payments_to_post', v_pays, 'bill_payments_total', v_pays_p,
    'expenses_to_post', v_exp, 'expenses_total', v_exp_p, 'to_reverse', v_rev, 'already_posted', v_done, 'not_posted', v_none, 'skipped', v_skip);
END;
$function$;

-- Preview (replaced): the 3a invoice preview, unchanged, plus bills_and_expenses (read only; members may look).
CREATE OR REPLACE FUNCTION public.ledger_auto_preview(p_org uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_rule text; r record; v_plan jsonb; v_k text; v_want jsonb; l public.ledger_postings; v_issue_live boolean;
  v_inv integer := 0; v_inv_p bigint := 0; v_pay integer := 0; v_pay_p bigint := 0; v_rev integer := 0; v_done integer := 0; v_none integer := 0;
  v_skip jsonb := '{}'::jsonb; v_reason text;
BEGIN
  PERFORM public.require_aal2_if_enrolled();
  v_rule := public._ledger_rule(p_org, auth.uid());
  IF v_rule NOT IN ('ok', 'not_admin') THEN RAISE EXCEPTION 'LEDGER_%', upper(v_rule) USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ledger_settings s WHERE s.organization_id = p_org) THEN RAISE EXCEPTION 'LEDGER_NOT_SET_UP' USING ERRCODE = '22023'; END IF;
  FOR r IN SELECT i.id FROM public.invoices i WHERE i.organization_id = p_org
           UNION SELECT p.source_id FROM public.ledger_postings p WHERE p.organization_id = p_org AND p.reversed_at IS NULL LOOP
    v_plan := public._ledger_auto_plan(p_org, r.id);
    IF NOT (v_plan #>> '{issue,want}')::boolean AND v_plan #>> '{issue,reason}' IS NULL AND NOT EXISTS (
         SELECT 1 FROM public.ledger_postings p WHERE p.organization_id = p_org AND p.source_id = r.id AND p.reversed_at IS NULL) THEN
      v_none := v_none + 1;
      CONTINUE;
    END IF;
    v_issue_live := false;
    FOREACH v_k IN ARRAY ARRAY['invoice_issued', 'invoice_paid'] LOOP
      v_want := v_plan -> CASE v_k WHEN 'invoice_paid' THEN 'payment' ELSE 'issue' END;
      SELECT * INTO l FROM public.ledger_postings p WHERE p.organization_id = p_org AND p.source_table = 'invoices' AND p.source_id = r.id AND p.kind = v_k AND p.reversed_at IS NULL;
      IF FOUND THEN
        IF (v_want ->> 'want')::boolean AND v_want ->> 'hash' = l.version_hash THEN
          v_done := v_done + 1;
          IF v_k = 'invoice_issued' THEN v_issue_live := true; END IF;
          CONTINUE;
        END IF;
        v_rev := v_rev + 1;
      END IF;
      IF (v_want ->> 'want')::boolean THEN
        IF v_k = 'invoice_issued' THEN v_inv := v_inv + 1; v_inv_p := v_inv_p + (v_want ->> 'total')::bigint; v_issue_live := true;
        ELSE v_pay := v_pay + 1; v_pay_p := v_pay_p + (v_want ->> 'total')::bigint; END IF;
      ELSIF v_want ->> 'reason' IS NOT NULL THEN
        v_reason := v_want ->> 'reason';
        v_skip := jsonb_set(v_skip, ARRAY[v_reason], to_jsonb(COALESCE((v_skip ->> v_reason)::integer, 0) + 1));
      END IF;
    END LOOP;
  END LOOP;
  RETURN jsonb_build_object('invoices_to_post', v_inv, 'invoices_total', v_inv_p, 'payments_to_post', v_pay, 'payments_total', v_pay_p,
    'to_reverse', v_rev, 'already_posted', v_done, 'not_issued', v_none, 'skipped', v_skip,
    'bills_and_expenses', public._ledger_auto_preview_records(p_org));
END;
$function$;

-- Post existing bills and expenses (the invoice catch-up ledger_auto_catch_up(uuid) is unchanged).
CREATE FUNCTION public.ledger_auto_catch_up(p_org uuid, p_switch text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_n integer; v_run jsonb;
BEGIN
  IF p_switch IS DISTINCT FROM 'bills_and_expenses' THEN
    IF p_switch = 'invoices' THEN RETURN public.ledger_auto_catch_up(p_org); END IF;
    RAISE EXCEPTION 'LEDGER_BAD_REQUEST' USING ERRCODE = '22023';
  END IF;
  PERFORM public._ledger_require_writer(p_org);
  IF NOT EXISTS (SELECT 1 FROM public.ledger_auto_settings a WHERE a.organization_id = p_org AND a.bills_enabled) THEN
    RAISE EXCEPTION 'LEDGER_AUTO_OFF' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.ledger_post_queue (organization_id, source_table, source_id)
  SELECT p_org, x.t, x.id FROM (SELECT 'bills'::text AS t, b.id FROM public.bills b WHERE b.organization_id = p_org
                                UNION SELECT 'expenses', e.id FROM public.expenses e WHERE e.organization_id = p_org
                                UNION SELECT p.source_table, p.source_id FROM public.ledger_postings p
                                       WHERE p.organization_id = p_org AND p.source_table IN ('bills', 'expenses') AND p.reversed_at IS NULL) x
   WHERE NOT EXISTS (SELECT 1 FROM public.ledger_post_queue q WHERE q.organization_id = p_org AND q.source_table = x.t AND q.source_id = x.id);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_run := public.ledger_process_queue(p_org, 200);
  RETURN jsonb_build_object('queued', v_n) || v_run;
END;
$function$;

-- Post now (replaced): either switch on is enough.
CREATE OR REPLACE FUNCTION public.ledger_auto_run(p_org uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  PERFORM public._ledger_require_writer(p_org);
  IF NOT EXISTS (SELECT 1 FROM public.ledger_auto_settings a WHERE a.organization_id = p_org AND (a.invoices_enabled OR a.bills_enabled)) THEN
    RAISE EXCEPTION 'LEDGER_AUTO_OFF' USING ERRCODE = '22023';
  END IF;
  RETURN public.ledger_process_queue(p_org, 200);
END;
$function$;

-- 9. Privileges: internal functions for nobody but the owner; the RPCs for signed-in callers (each checks who).
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public._ledger_auto_category_key(text)', 'public._ledger_auto_default_categories()', 'public._ledger_auto_seed_category_map(uuid)',
    'public._ledger_auto_category_account(uuid,text)', 'public._ledger_auto_want(text,date,text,text,jsonb,bigint,text,text)',
    'public._ledger_auto_bill_plan(uuid,uuid)', 'public._ledger_auto_expense_plan(uuid,uuid)', 'public._ledger_auto_record_plan(uuid,text,uuid)',
    'public._ledger_auto_flag(uuid,text,uuid,text,text,text)', 'public._ledger_auto_apply_record(uuid,text,uuid)', 'public._ledger_auto_source_ready(uuid,text)',
    'public._ledger_auto_record_changed()', 'public._ledger_auto_preview_records(uuid)', 'public.ledger_process_queue(uuid,integer)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f);
  END LOOP;
  FOREACH f IN ARRAY ARRAY['public.ledger_auto_status(uuid)', 'public.ledger_auto_set(uuid,boolean)', 'public.ledger_auto_set(uuid,boolean,text)',
    'public.ledger_auto_preview(uuid)', 'public.ledger_auto_catch_up(uuid)', 'public.ledger_auto_catch_up(uuid,text)', 'public.ledger_auto_run(uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
END $$;

DO $$
BEGIN
  IF has_table_privilege('authenticated', 'public.ledger_category_map', 'INSERT') OR has_table_privilege('service_role', 'public.ledger_category_map', 'UPDATE')
     OR has_table_privilege('anon', 'public.ledger_category_map', 'SELECT')
     OR has_function_privilege('authenticated', 'public._ledger_auto_apply_record(uuid,text,uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public._ledger_auto_bill_plan(uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.ledger_process_queue(uuid,integer)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.ledger_auto_set(uuid,boolean,text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.ledger_auto_catch_up(uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'privileges are not as intended';
  END IF;
END $$;

COMMIT;
