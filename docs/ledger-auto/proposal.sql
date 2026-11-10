-- =====================================================================================================================
-- Finance phase 3a: automatic ledger postings for invoices and invoice payments. PREPARED, NOT APPLIED.
-- Read docs/ledger-auto/README.md first. One transaction. Additive, except ONE change to an existing table:
-- the CHECK constraint je_source_type on public.journal_entries gains 'auto_invoice' and 'auto_invoice_payment'.
-- Plus one new AFTER trigger on public.invoices that only ever adds a row to a queue and can never fail the save.
--
--  1. journal_entries.je_source_type: + 'auto_invoice', 'auto_invoice_payment'. Every other constraint, trigger,
--     guard and policy of phase 2 is unchanged (append-only, the balance rule, the P7b gate exceptions).
--  2. New tables: ledger_auto_settings (the switch, default off), ledger_post_queue (invoices waiting to be looked at),
--     ledger_postings (which journal posted which invoice version: never twice), ledger_post_issues (needs attention).
--  3. Trigger ledger_auto_invoice on invoices: AFTER INSERT/UPDATE/DELETE; if the company switched automatic postings
--     on, one queue row; any error is swallowed (the invoice is saved whatever happens here).
--  4. ledger_process_queue(): posts from the queue in order, at most 200 invoices per run, idempotently, under the
--     same per-company advisory lock as _ledger_post. Run by pg_cron (docs/ledger-auto/schedule.sql, applied after
--     this) and on demand by ledger_auto_catch_up / ledger_auto_run.
--  5. RPCs: ledger_auto_status, ledger_auto_set, ledger_auto_preview, ledger_auto_catch_up, ledger_auto_run.
--     The plan rule is phase 2's _ledger_rule (hmrc_manage_allowed: Business, Scale and the trial; owner or admin).
--
-- Production facts this was written against: the repository as merged on 10 Nov 2026 (docs/ledger applied, with the
-- comment-stripped hashes recorded in docs/ledger/README.md): 152 tables in public (md5 of the sorted names
-- 185ba338b34d22b6189306e30de56545), the invoices columns below, je_source_type as phase 2 created it, and the
-- md5(prosrc) of each helper below, raw or with its whole-line comments removed (production keeps some bodies that
-- way). THE OWNER'S ASSISTANT RE-VERIFIES THESE AGAINST PRODUCTION BEFORE APPLYING; anything else: refused.
-- Rollback: docs/ledger-auto/rollback.sql (refuses while any posting row exists). Tests: docs/ledger-auto/run-test.sh.
-- =====================================================================================================================
BEGIN;

DO $$
DECLARE r record; v text;
BEGIN
  IF to_regclass('public.ledger_auto_settings') IS NOT NULL OR to_regclass('public.ledger_post_queue') IS NOT NULL
     OR to_regclass('public.ledger_postings') IS NOT NULL OR to_regclass('public.ledger_post_issues') IS NOT NULL THEN
    RAISE EXCEPTION 'Finance phase 3a automatic postings already exist (applied twice?)';
  END IF;
  IF (SELECT md5(string_agg(relname, ',' ORDER BY relname)) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind IN ('r', 'p'))
     IS DISTINCT FROM '185ba338b34d22b6189306e30de56545' THEN
    RAISE EXCEPTION 'the tables in public differ from production as read on 10 Nov 2026';
  END IF;
  FOR r IN SELECT * FROM (VALUES
      ('public.hmrc_manage_allowed(uuid,uuid)', '9304f069f05402aab62d343b3626cd65', '801908512427b85279c33bfffd64922e'),
      ('public.user_is_organization_member(uuid,uuid)', '1fb55538d44b2451875f8baf1b6e4388', '1fb55538d44b2451875f8baf1b6e4388'),
      ('public.require_aal2_if_enrolled()', '10b2ae7bd2f9a94ea20598f19b8aebf2', '10b2ae7bd2f9a94ea20598f19b8aebf2'),
      ('public.mfa_ok()', '20516f2ec203220b3ac08d1230c7c306', 'c6fd9b98a36055f056bbd682cb57f3aa'),
      ('public.demo_readonly_guard()', '087b5fe2695b95b8ba2ba6eb195ba995', '087b5fe2695b95b8ba2ba6eb195ba995'),
      ('public._data_rights_gate_is_open(text)', 'b22b22eda6bd86e8ff363a6a58bfe3a3', 'b22b22eda6bd86e8ff363a6a58bfe3a3'),
      ('public._data_rights_closed_company_guard()', '2ec2d8630e284aed65d010c61a442a53', '2ec2d8630e284aed65d010c61a442a53'),
      ('public._data_rights_company_tables()', 'c4497fd5fa0245618d1168f9c19bffe1', 'c4497fd5fa0245618d1168f9c19bffe1'),
      ('public._data_rights_close_org(uuid,uuid)', 'b0c5e82fc596390a6275b53524947531', '6c379a1d11b0e469c13ec57e4f054678'),
      ('public.data_rights_delete_account(uuid,uuid,boolean)', 'b1922b7985b959d094e72248019551fa', '4492cbbb945bbe7a7f72b83b249bcaef'),
      ('public._ledger_rule(uuid,uuid)', 'edf2117e8b0bdeb3826552b712faa227', 'edf2117e8b0bdeb3826552b712faa227'),
      ('public._ledger_org_open(uuid)', '361077573d6cc7f9c83c6702808d61cd', '361077573d6cc7f9c83c6702808d61cd'),
      ('public._ledger_require_writer(uuid)', '75ecf4a981581daae33e90dc554f01c4', '75ecf4a981581daae33e90dc554f01c4'),
      ('public._ledger_append_only()', 'f47e341b7cca2f0118e8e70493984e56', 'f47e341b7cca2f0118e8e70493984e56'),
      ('public._ledger_entry_guard()', '727748e665991e8105a96e15f7f9929c', '727748e665991e8105a96e15f7f9929c'),
      ('public._ledger_line_guard()', '1c805547e284b65803d2f9bbb480d761', '041398b1d1ecbd5856c7cab85aff8479'),
      ('public._ledger_balance_check()', 'ee84f8fd18cb93fcd9fa1dfbd6aa36e7', 'ee84f8fd18cb93fcd9fa1dfbd6aa36e7'),
      ('public.ledger_reverse_journal(uuid,text,date)', '22157acb97b8b8cb3ade3318177353b9', '22157acb97b8b8cb3ade3318177353b9')) x(fn, raw, stripped) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = to_regprocedure(r.fn)
                    AND (md5(prosrc) IN (r.raw, r.stripped) OR md5(regexp_replace(prosrc, E'\\n[ \\t]*--[^\\n]*', '', 'g')) IN (r.raw, r.stripped))) THEN
      RAISE EXCEPTION '% differs from the body this was written against (or is missing)', r.fn;
    END IF;
  END LOOP;
  SELECT pg_get_constraintdef(oid) INTO v FROM pg_constraint WHERE conrelid = 'public.journal_entries'::regclass AND conname = 'je_source_type';
  IF v IS DISTINCT FROM 'CHECK ((source_type = ANY (ARRAY[''manual''::text, ''opening_balance''::text, ''reversal''::text])))' THEN
    RAISE EXCEPTION 'journal_entries.je_source_type differs from phase 2 (%)', v;
  END IF;
  SELECT string_agg(attname || ':' || format_type(atttypid, atttypmod), ',' ORDER BY attname) INTO v FROM pg_attribute
   WHERE attrelid = 'public.invoices'::regclass AND NOT attisdropped
     AND attname IN ('id', 'organization_id', 'user_id', 'invoice_number', 'status', 'subtotal', 'tax_amount', 'total_amount', 'currency',
                     'paid_at', 'tax_point_date', 'archived_at', 'created_at');
  IF v IS DISTINCT FROM 'archived_at:timestamp with time zone,created_at:timestamp with time zone,currency:text,id:uuid,invoice_number:text,organization_id:uuid,'
                     || 'paid_at:timestamp with time zone,status:text,subtotal:numeric(10,2),tax_amount:numeric(10,2),tax_point_date:date,total_amount:numeric(10,2),user_id:uuid' THEN
    RAISE EXCEPTION 'invoices columns differ (%)', v;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.invoices'::regclass AND tgname = 'ledger_auto_invoice') THEN
    RAISE EXCEPTION 'invoices already has a ledger_auto_invoice trigger';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.organization_members'::regclass AND attname = 'is_active' AND NOT attisdropped) THEN
    RAISE EXCEPTION 'organization_members.is_active is missing';
  END IF;
END $$;

-- 1. The one change to an existing table: two new automatic journal types. A reversal of an automatic journal is still
--    source_type 'reversal' (je_reversal is unchanged), so ledger_reverse_journal works on them as on any journal.
ALTER TABLE public.journal_entries DROP CONSTRAINT je_source_type;
ALTER TABLE public.journal_entries ADD CONSTRAINT je_source_type
  CHECK (source_type IN ('manual', 'opening_balance', 'reversal', 'auto_invoice', 'auto_invoice_payment'));

-- 2. Tables.
CREATE TABLE public.ledger_auto_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id),
  invoices_enabled boolean NOT NULL DEFAULT false,
  enabled_at timestamptz,
  enabled_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.ledger_auto_settings IS 'Finance phase 3a: per company, whether invoices post to the ledger automatically (default off). Written only by ledger_auto_set. enabled_by is an opaque id (no foreign key).';

CREATE TABLE public.ledger_post_queue (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  source_table text NOT NULL CONSTRAINT lpq_source_table CHECK (source_table = 'invoices'),
  source_id uuid NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CONSTRAINT lpq_attempts CHECK (attempts BETWEEN 0 AND 100),
  last_error text CONSTRAINT lpq_last_error CHECK (last_error IS NULL OR last_error ~ '^[0-9A-Z]{5}$'),
  enqueued_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ledger_post_queue_org ON public.ledger_post_queue (organization_id, source_id, id);
COMMENT ON TABLE public.ledger_post_queue IS 'Finance phase 3a: invoices waiting to be looked at by ledger_process_queue. Short-lived: a row goes once processed. last_error is a SQLSTATE only.';

CREATE TABLE public.ledger_postings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  source_table text NOT NULL CONSTRAINT lp_source_table CHECK (source_table = 'invoices'),
  source_id uuid NOT NULL,
  source_label text CONSTRAINT lp_source_label CHECK (source_label IS NULL OR length(source_label) <= 120),
  kind text NOT NULL CONSTRAINT lp_kind CHECK (kind IN ('invoice_issued', 'invoice_paid')),
  version_hash text NOT NULL CONSTRAINT lp_version_hash CHECK (version_hash ~ '^[0-9a-f]{32}$'),
  entry_id uuid NOT NULL UNIQUE REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  reversal_entry_id uuid UNIQUE REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  reversed_how text CONSTRAINT lp_reversed_how CHECK (reversed_how IS NULL OR reversed_how IN ('automatic', 'by_hand')),
  reversed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lp_reversal CHECK ((reversed_at IS NULL) = (reversal_entry_id IS NULL) AND (reversed_at IS NULL) = (reversed_how IS NULL))
);
-- No double posting: one live posting per invoice and kind (so the same version can never post twice either). A new
-- version posts only after the earlier journal was reversed. No foreign key to invoices: deleting an invoice is never blocked.
CREATE UNIQUE INDEX ledger_postings_one_live ON public.ledger_postings (organization_id, source_table, source_id, kind) WHERE reversed_at IS NULL;
CREATE INDEX ledger_postings_source ON public.ledger_postings (organization_id, source_table, source_id, kind, version_hash);
COMMENT ON TABLE public.ledger_postings IS 'Finance phase 3a: which automatic journal posted which invoice version, and how it was reversed. Written only by the posting functions.';

CREATE TABLE public.ledger_post_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  source_table text NOT NULL CONSTRAINT lpi_source_table CHECK (source_table = 'invoices'),
  source_id uuid NOT NULL,
  source_label text CONSTRAINT lpi_source_label CHECK (source_label IS NULL OR length(source_label) <= 120),
  kind text NOT NULL CONSTRAINT lpi_kind CHECK (kind IN ('invoice_issued', 'invoice_paid')),
  reason_code text NOT NULL CONSTRAINT lpi_reason CHECK (reason_code IN ('before_start', 'period_locked', 'amounts_do_not_add_up', 'amounts_missing',
    'not_whole_pence', 'zero_total', 'negative_amount', 'currency_not_gbp', 'paid_date_missing', 'issue_not_posted', 'reversal_period_locked', 'processing_failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE UNIQUE INDEX ledger_post_issues_one_open ON public.ledger_post_issues (organization_id, source_table, source_id, kind) WHERE resolved_at IS NULL;
COMMENT ON TABLE public.ledger_post_issues IS 'Finance phase 3a: invoices that were not posted, with a plain reason code. Resolved automatically when the invoice is fixed.';

-- History guards: a posting row only ever gains its reversal; an issue only ever gets resolved; rows go only with the
-- company (the P7b 'company_close' gate). The settings and the queue are written by the functions below only.
CREATE FUNCTION public._ledger_auto_history_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'TRUNCATE' THEN RAISE EXCEPTION 'LEDGER_APPEND_ONLY: posting history is never removed' USING ERRCODE = '42501'; END IF;
  IF TG_OP = 'DELETE' THEN
    IF public._data_rights_gate_is_open('company_close') THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'LEDGER_APPEND_ONLY: posting history goes only with the company' USING ERRCODE = '42501';
  END IF;
  IF TG_TABLE_NAME = 'ledger_postings' THEN
    IF OLD.reversed_at IS NULL AND NEW.reversed_at IS NOT NULL
       AND (to_jsonb(NEW) - 'reversal_entry_id' - 'reversed_how' - 'reversed_at') = (to_jsonb(OLD) - 'reversal_entry_id' - 'reversed_how' - 'reversed_at') THEN
      RETURN NEW;
    END IF;
  ELSE
    IF OLD.resolved_at IS NULL AND NEW.resolved_at IS NOT NULL AND (to_jsonb(NEW) - 'resolved_at') = (to_jsonb(OLD) - 'resolved_at') THEN
      RETURN NEW;
    END IF;
  END IF;
  RAISE EXCEPTION 'LEDGER_APPEND_ONLY: posting history can''t be changed' USING ERRCODE = '42501';
END;
$function$;
REVOKE ALL ON FUNCTION public._ledger_auto_history_guard() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER ledger_auto_history_guard BEFORE UPDATE OR DELETE ON public.ledger_postings FOR EACH ROW EXECUTE FUNCTION public._ledger_auto_history_guard();
CREATE TRIGGER ledger_auto_history_guard BEFORE UPDATE OR DELETE ON public.ledger_post_issues FOR EACH ROW EXECUTE FUNCTION public._ledger_auto_history_guard();
CREATE TRIGGER ledger_auto_no_truncate BEFORE TRUNCATE ON public.ledger_postings FOR EACH STATEMENT EXECUTE FUNCTION public._ledger_auto_history_guard();
CREATE TRIGGER ledger_auto_no_truncate BEFORE TRUNCATE ON public.ledger_post_issues FOR EACH STATEMENT EXECUTE FUNCTION public._ledger_auto_history_guard();

-- Closed companies get no new rows (the P7b guard); demo accounts are read only (the demo guard).
CREATE TRIGGER data_rights_closed_company BEFORE INSERT OR UPDATE ON public.ledger_auto_settings FOR EACH ROW EXECUTE FUNCTION public._data_rights_closed_company_guard('organization_id');
CREATE TRIGGER data_rights_closed_company BEFORE INSERT ON public.ledger_post_queue FOR EACH ROW EXECUTE FUNCTION public._data_rights_closed_company_guard('organization_id');
CREATE TRIGGER data_rights_closed_company BEFORE INSERT ON public.ledger_postings FOR EACH ROW EXECUTE FUNCTION public._data_rights_closed_company_guard('organization_id');
CREATE TRIGGER data_rights_closed_company BEFORE INSERT ON public.ledger_post_issues FOR EACH ROW EXECUTE FUNCTION public._data_rights_closed_company_guard('organization_id');
CREATE TRIGGER a0_demo_readonly_guard BEFORE INSERT OR UPDATE OR DELETE ON public.ledger_auto_settings FOR EACH ROW EXECUTE FUNCTION public.demo_readonly_guard();
CREATE TRIGGER a0_demo_readonly_guard BEFORE INSERT OR UPDATE OR DELETE ON public.ledger_post_queue FOR EACH ROW EXECUTE FUNCTION public.demo_readonly_guard();
CREATE TRIGGER a0_demo_readonly_guard BEFORE INSERT OR UPDATE OR DELETE ON public.ledger_postings FOR EACH ROW EXECUTE FUNCTION public.demo_readonly_guard();
CREATE TRIGGER a0_demo_readonly_guard BEFORE INSERT OR UPDATE OR DELETE ON public.ledger_post_issues FOR EACH ROW EXECUTE FUNCTION public.demo_readonly_guard();

-- RLS: members read their company's rows; nobody writes directly; aal2 when enrolled; closed companies hidden.
ALTER TABLE public.ledger_auto_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_post_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_post_issues ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ledger_auto_settings, public.ledger_post_queue, public.ledger_postings, public.ledger_post_issues FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.ledger_auto_settings, public.ledger_post_queue, public.ledger_postings, public.ledger_post_issues TO authenticated, service_role;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ledger_auto_settings', 'ledger_post_queue', 'ledger_postings', 'ledger_post_issues'] LOOP
    EXECUTE format('CREATE POLICY "Company members can read automatic postings" ON public.%I FOR SELECT TO authenticated
                      USING (public.user_is_organization_member(organization_id, (SELECT auth.uid())))', t);
    EXECUTE format('CREATE POLICY require_aal2_if_enrolled ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()))', t);
    EXECUTE format('CREATE POLICY ledger_hide_closed ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (public._ledger_org_open(organization_id))', t);
  END LOOP;
END $$;

-- 3. The invoice trigger: never fails the save, never posts. It adds one queue row per company that switched
--    automatic postings on (two if the invoice moved company), and only when something the ledger uses changed.
CREATE FUNCTION public._ledger_auto_invoice_changed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_orgs uuid[]; v_id uuid; v_org uuid;
BEGIN
  BEGIN
    -- Company closure deletes the invoices with the ledger: nothing to queue.
    IF public._data_rights_gate_is_open('company_close') THEN RETURN NULL; END IF;
    IF TG_OP = 'INSERT' THEN
      v_orgs := ARRAY[NEW.organization_id]; v_id := NEW.id;
    ELSIF TG_OP = 'DELETE' THEN
      v_orgs := ARRAY[OLD.organization_id]; v_id := OLD.id;
    ELSE
      IF (NEW.status, NEW.paid_at, NEW.subtotal, NEW.tax_amount, NEW.total_amount, NEW.currency, NEW.tax_point_date, NEW.created_at,
          NEW.invoice_number, NEW.archived_at, NEW.organization_id, NEW.id)
         IS NOT DISTINCT FROM
         (OLD.status, OLD.paid_at, OLD.subtotal, OLD.tax_amount, OLD.total_amount, OLD.currency, OLD.tax_point_date, OLD.created_at,
          OLD.invoice_number, OLD.archived_at, OLD.organization_id, OLD.id) THEN
        RETURN NULL;
      END IF;
      v_orgs := ARRAY[NEW.organization_id, OLD.organization_id]; v_id := NEW.id;
    END IF;
    FOR v_org IN SELECT DISTINCT x FROM unnest(v_orgs) x WHERE x IS NOT NULL LOOP
      IF EXISTS (SELECT 1 FROM public.ledger_auto_settings s WHERE s.organization_id = v_org AND s.invoices_enabled) THEN
        INSERT INTO public.ledger_post_queue (organization_id, source_table, source_id) VALUES (v_org, 'invoices', v_id);
      END IF;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- the invoice is saved whatever happens here; a missed row is picked up by the next catch-up
  END;
  RETURN NULL;
END;
$function$;
REVOKE ALL ON FUNCTION public._ledger_auto_invoice_changed() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER ledger_auto_invoice AFTER INSERT OR UPDATE OR DELETE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public._ledger_auto_invoice_changed();

-- 4. The posting logic.
-- Whole pence from a money value, or NULL when it isn't a whole number of pence (money columns are numeric(10,2) in
-- production; a float would be read through numeric, so 0.1 stays 0.10). Never compares floats.
CREATE FUNCTION public._ledger_auto_pence(v numeric)
 RETURNS bigint
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  SELECT CASE WHEN v IS NULL OR v * 100 <> round(v * 100) THEN NULL ELSE round(v * 100)::bigint END;
$function$;
REVOKE ALL ON FUNCTION public._ledger_auto_pence(numeric) FROM PUBLIC, anon, authenticated, service_role;

-- What the ledger should hold for one invoice of one company, by the posting rules (docs/ledger-auto/README.md):
-- {label, poster, issue: {want, reason, date, hash, subtotal, tax, total}, payment: {want, reason, date, hash, total}}.
-- want = post this version; reason = why it can't be posted (needs attention); neither = nothing to post (draft, archived,
-- deleted, unpaid, not this company). Amounts in whole pence.
CREATE FUNCTION public._ledger_auto_plan(p_org uuid, p_invoice uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  i public.invoices; s public.ledger_settings; v_status text; v_sub bigint; v_tax bigint; v_total bigint;
  v_date date; v_pay date; v_issue jsonb := jsonb_build_object('want', false); v_payment jsonb := jsonb_build_object('want', false);
  v_reason text; v_pay_reason text;
BEGIN
  SELECT * INTO i FROM public.invoices WHERE id = p_invoice;
  SELECT * INTO s FROM public.ledger_settings WHERE organization_id = p_org;
  IF NOT FOUND OR i.id IS NULL OR i.organization_id IS DISTINCT FROM p_org OR i.archived_at IS NOT NULL THEN
    RETURN jsonb_build_object('label', left(i.invoice_number, 120), 'poster', i.user_id, 'issue', v_issue, 'payment', v_payment);
  END IF;
  v_status := lower(btrim(COALESCE(i.status, '')));
  IF v_status NOT IN ('sent', 'overdue', 'paid') THEN -- draft (and anything else) never posts
    RETURN jsonb_build_object('label', left(i.invoice_number, 120), 'poster', i.user_id, 'issue', v_issue, 'payment', v_payment);
  END IF;
  -- The issue date: the tax point if set, otherwise the day the invoice was created (UK calendar day; the invoices table
  -- has no separate issue-date column).
  v_date := COALESCE(i.tax_point_date, (i.created_at AT TIME ZONE 'Europe/London')::date);
  v_sub := public._ledger_auto_pence(i.subtotal); v_tax := public._ledger_auto_pence(COALESCE(i.tax_amount, 0)); v_total := public._ledger_auto_pence(i.total_amount);
  v_reason := CASE
    WHEN upper(btrim(COALESCE(i.currency, ''))) <> 'GBP' THEN 'currency_not_gbp'
    WHEN i.subtotal IS NULL OR i.total_amount IS NULL THEN 'amounts_missing'
    WHEN v_sub IS NULL OR v_tax IS NULL OR v_total IS NULL THEN 'not_whole_pence'
    WHEN v_sub < 0 OR v_tax < 0 OR v_total < 0 THEN 'negative_amount'
    WHEN v_total = 0 THEN 'zero_total'
    WHEN v_sub + v_tax <> v_total THEN 'amounts_do_not_add_up'
    WHEN v_date < s.start_date THEN 'before_start'
    WHEN s.locked_through IS NOT NULL AND v_date <= s.locked_through THEN 'period_locked'
  END;
  IF v_reason IS NULL THEN
    v_issue := jsonb_build_object('want', true, 'date', v_date, 'subtotal', v_sub, 'tax', v_tax, 'total', v_total,
      'hash', md5(concat_ws('|', 'v1', i.invoice_number, v_date, v_sub, v_tax, v_total)));
  ELSE
    v_issue := jsonb_build_object('want', false, 'reason', v_reason, 'date', v_date, 'total', v_total);
  END IF;
  IF v_status = 'paid' THEN
    v_pay := (i.paid_at AT TIME ZONE 'Europe/London')::date;
    v_pay_reason := CASE
      WHEN i.paid_at IS NULL THEN 'paid_date_missing'
      WHEN v_pay < s.start_date THEN 'before_start'
      WHEN s.locked_through IS NOT NULL AND v_pay <= s.locked_through THEN 'period_locked'
      WHEN v_reason IS NOT NULL THEN 'issue_not_posted'
    END;
    -- One row is enough when both are before the start date (the issue row says it).
    IF v_reason = 'before_start' AND v_pay_reason = 'before_start' THEN v_pay_reason := NULL; END IF;
    IF v_pay_reason IS NULL THEN
      v_payment := jsonb_build_object('want', true, 'date', v_pay, 'total', v_total,
        'hash', md5(concat_ws('|', 'v1', i.invoice_number, v_pay, v_total)));
    ELSE
      v_payment := jsonb_build_object('want', false, 'reason', v_pay_reason, 'date', v_pay, 'total', v_total);
    END IF;
  END IF;
  RETURN jsonb_build_object('label', left(i.invoice_number, 120), 'poster', i.user_id, 'issue', v_issue, 'payment', v_payment);
END;
$function$;
REVOKE ALL ON FUNCTION public._ledger_auto_plan(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Writes one balanced automatic journal (or the reversal of one) and checks the balance rule straight away, so a
-- failure stays inside the caller's exception block instead of failing the whole run at commit.
-- p_lines: [{account_id, debit, credit}] in whole pence.
CREATE FUNCTION public._ledger_auto_journal(p_org uuid, p_date date, p_memo text, p_source_type text, p_source_id uuid, p_poster uuid,
                                            p_lines jsonb, p_reverses uuid DEFAULT NULL)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_entry uuid; v_line jsonb; v_i integer := 0;
BEGIN
  INSERT INTO public.journal_entries (organization_id, entry_date, memo, reason, source_type, source_id, reverses_entry_id, posted_by, posted_by_name)
  VALUES (p_org, p_date, left(p_memo, 200), 'Automatic posting', p_source_type, p_source_id, p_reverses, p_poster, 'Automatic posting')
  RETURNING id INTO v_entry;
  PERFORM set_config('ledger.posting_entry', v_entry::text, true);
  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
    v_i := v_i + 1;
    INSERT INTO public.journal_lines (entry_id, organization_id, account_id, line_no, debit, credit)
    VALUES (v_entry, p_org, (v_line ->> 'account_id')::uuid, v_i, (v_line ->> 'debit')::bigint / 100.0, (v_line ->> 'credit')::bigint / 100.0);
  END LOOP;
  PERFORM set_config('ledger.posting_entry', '', true);
  SET CONSTRAINTS public.ledger_balanced IMMEDIATE;
  SET CONSTRAINTS public.ledger_balanced DEFERRED;
  RETURN v_entry;
END;
$function$;
REVOKE ALL ON FUNCTION public._ledger_auto_journal(uuid, date, text, text, uuid, uuid, jsonb, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Opens (or keeps) the one open issue for an invoice and kind; p_reason NULL resolves it.
CREATE FUNCTION public._ledger_auto_issue(p_org uuid, p_invoice uuid, p_label text, p_kind text, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_open public.ledger_post_issues;
BEGIN
  SELECT * INTO v_open FROM public.ledger_post_issues WHERE organization_id = p_org AND source_table = 'invoices' AND source_id = p_invoice AND kind = p_kind AND resolved_at IS NULL;
  IF FOUND AND v_open.reason_code IS NOT DISTINCT FROM p_reason THEN RETURN; END IF;
  IF FOUND THEN UPDATE public.ledger_post_issues SET resolved_at = now() WHERE id = v_open.id; END IF;
  IF p_reason IS NOT NULL THEN
    INSERT INTO public.ledger_post_issues (organization_id, source_table, source_id, source_label, kind, reason_code)
    VALUES (p_org, 'invoices', p_invoice, p_label, p_kind, p_reason);
  END IF;
END;
$function$;
REVOKE ALL ON FUNCTION public._ledger_auto_issue(uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated, service_role;

-- Brings the ledger in line with one invoice: reverses what no longer matches (payment before issue), then posts what
-- is missing (issue before payment), and records or resolves the needs-attention rows. Idempotent.
CREATE FUNCTION public._ledger_auto_apply(p_org uuid, p_invoice uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_plan jsonb; v_k text; v_want jsonb; l public.ledger_postings; e public.journal_entries; s public.ledger_settings;
  v_rev uuid; v_date date; v_lines jsonb; v_entry uuid; v_posted integer := 0; v_blocked text[] := '{}'; v_label text; v_poster uuid;
  v_debtors uuid; v_sales uuid; v_vat uuid; v_bank uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('ledger:' || p_org::text, 0));
  SELECT * INTO s FROM public.ledger_settings WHERE organization_id = p_org;
  IF NOT FOUND THEN RETURN 0; END IF;
  v_plan := public._ledger_auto_plan(p_org, p_invoice);
  v_label := v_plan ->> 'label';
  -- 1. Reverse what no longer matches: the payment first, then the issue.
  FOREACH v_k IN ARRAY ARRAY['invoice_paid', 'invoice_issued'] LOOP
    v_want := v_plan -> CASE v_k WHEN 'invoice_paid' THEN 'payment' ELSE 'issue' END;
    SELECT * INTO l FROM public.ledger_postings WHERE organization_id = p_org AND source_table = 'invoices' AND source_id = p_invoice AND kind = v_k AND reversed_at IS NULL;
    CONTINUE WHEN NOT FOUND;
    v_label := COALESCE(v_label, l.source_label);
    -- Reversed by hand already (ledger_reverse_journal): record it; that version is not posted again.
    SELECT r.id INTO v_rev FROM public.journal_entries r WHERE r.reverses_entry_id = l.entry_id;
    IF v_rev IS NOT NULL THEN
      UPDATE public.ledger_postings SET reversal_entry_id = v_rev, reversed_how = 'by_hand', reversed_at = now() WHERE id = l.id;
      CONTINUE;
    END IF;
    CONTINUE WHEN (v_want ->> 'want')::boolean AND v_want ->> 'hash' = l.version_hash;
    SELECT * INTO e FROM public.journal_entries WHERE id = l.entry_id;
    -- The reversal is dated like the original while that date is open, otherwise today.
    v_date := CASE WHEN s.locked_through IS NULL OR e.entry_date > s.locked_through THEN e.entry_date ELSE current_date END;
    IF s.locked_through IS NOT NULL AND v_date <= s.locked_through THEN
      v_blocked := v_blocked || v_k;
      PERFORM public._ledger_auto_issue(p_org, p_invoice, v_label, v_k, 'reversal_period_locked');
      CONTINUE;
    END IF;
    SELECT jsonb_agg(jsonb_build_object('account_id', jl.account_id, 'debit', public._ledger_auto_pence(jl.credit), 'credit', public._ledger_auto_pence(jl.debit)) ORDER BY jl.line_no)
      INTO v_lines FROM public.journal_lines jl WHERE jl.entry_id = e.id;
    v_rev := public._ledger_auto_journal(p_org, v_date, 'Reversal: ' || e.memo, 'reversal', e.source_id, e.posted_by, v_lines, e.id);
    UPDATE public.ledger_postings SET reversal_entry_id = v_rev, reversed_how = 'automatic', reversed_at = now() WHERE id = l.id;
    v_posted := v_posted + 1;
  END LOOP;
  -- A blocked reversal leaves the old journal live: nothing new may post on top of it.
  IF cardinality(v_blocked) > 0 THEN RETURN v_posted; END IF;

  v_poster := (v_plan ->> 'poster')::uuid;
  SELECT a.id INTO v_debtors FROM public.ledger_accounts a WHERE a.organization_id = p_org AND a.system_key = 'debtors';
  SELECT a.id INTO v_sales FROM public.ledger_accounts a WHERE a.organization_id = p_org AND a.system_key = 'sales';
  SELECT a.id INTO v_vat FROM public.ledger_accounts a WHERE a.organization_id = p_org AND a.system_key = 'vat_control';
  SELECT a.id INTO v_bank FROM public.ledger_accounts a WHERE a.organization_id = p_org AND a.system_key = 'bank';
  -- 2. Post what is missing: the issue first, then the payment.
  FOREACH v_k IN ARRAY ARRAY['invoice_issued', 'invoice_paid'] LOOP
    v_want := v_plan -> CASE v_k WHEN 'invoice_paid' THEN 'payment' ELSE 'issue' END;
    IF NOT (v_want ->> 'want')::boolean THEN
      PERFORM public._ledger_auto_issue(p_org, p_invoice, v_label, v_k, v_want ->> 'reason');
      CONTINUE;
    END IF;
    CONTINUE WHEN EXISTS (SELECT 1 FROM public.ledger_postings WHERE organization_id = p_org AND source_table = 'invoices' AND source_id = p_invoice AND kind = v_k AND reversed_at IS NULL);
    -- A version someone reversed by hand stays reversed (change the invoice and the new version posts).
    IF EXISTS (SELECT 1 FROM public.ledger_postings WHERE organization_id = p_org AND source_table = 'invoices' AND source_id = p_invoice AND kind = v_k
                 AND version_hash = v_want ->> 'hash' AND reversed_how = 'by_hand') THEN
      PERFORM public._ledger_auto_issue(p_org, p_invoice, v_label, v_k, NULL);
      CONTINUE;
    END IF;
    IF v_k = 'invoice_paid' AND NOT EXISTS (SELECT 1 FROM public.ledger_postings WHERE organization_id = p_org AND source_table = 'invoices'
                                              AND source_id = p_invoice AND kind = 'invoice_issued' AND reversed_at IS NULL) THEN
      PERFORM public._ledger_auto_issue(p_org, p_invoice, v_label, v_k, 'issue_not_posted');
      CONTINUE;
    END IF;
    IF v_k = 'invoice_issued' THEN
      v_lines := jsonb_build_array(jsonb_build_object('account_id', v_debtors, 'debit', (v_want ->> 'total')::bigint, 'credit', 0),
                                   jsonb_build_object('account_id', v_sales, 'debit', 0, 'credit', (v_want ->> 'subtotal')::bigint));
      IF (v_want ->> 'tax')::bigint > 0 THEN
        v_lines := v_lines || jsonb_build_object('account_id', v_vat, 'debit', 0, 'credit', (v_want ->> 'tax')::bigint);
      END IF;
      v_entry := public._ledger_auto_journal(p_org, (v_want ->> 'date')::date, 'Invoice ' || left(v_label, 150) || ' issued', 'auto_invoice', p_invoice, v_poster, v_lines);
    ELSE
      v_lines := jsonb_build_array(jsonb_build_object('account_id', v_bank, 'debit', (v_want ->> 'total')::bigint, 'credit', 0),
                                   jsonb_build_object('account_id', v_debtors, 'debit', 0, 'credit', (v_want ->> 'total')::bigint));
      v_entry := public._ledger_auto_journal(p_org, (v_want ->> 'date')::date, 'Invoice ' || left(v_label, 150) || ' paid', 'auto_invoice_payment', p_invoice, v_poster, v_lines);
    END IF;
    INSERT INTO public.ledger_postings (organization_id, source_table, source_id, source_label, kind, version_hash, entry_id)
    VALUES (p_org, 'invoices', p_invoice, v_label, v_k, v_want ->> 'hash', v_entry);
    PERFORM public._ledger_auto_issue(p_org, p_invoice, v_label, v_k, NULL);
    v_posted := v_posted + 1;
  END LOOP;
  RETURN v_posted;
END;
$function$;
REVOKE ALL ON FUNCTION public._ledger_auto_apply(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- A company whose automatic postings may run: open, set up, switched on, and at least one active owner or admin whose
-- plan includes the ledger (phase 2's rule). Used by the queue runner, which has no signed-in person.
CREATE FUNCTION public._ledger_auto_org_ready(p_org uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT public._ledger_org_open(p_org)
     AND EXISTS (SELECT 1 FROM public.ledger_settings s WHERE s.organization_id = p_org)
     AND EXISTS (SELECT 1 FROM public.ledger_auto_settings a WHERE a.organization_id = p_org AND a.invoices_enabled)
     AND EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id = p_org AND m.is_active AND public._ledger_rule(p_org, m.user_id) = 'ok');
$function$;
REVOKE ALL ON FUNCTION public._ledger_auto_org_ready(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- The queue runner: at most p_limit invoices per run, oldest first, each in its own sub-transaction so one failure never
-- stops the rest. A company that isn't ready (switched off, plan ended, closed) loses its waiting rows: switching back on
-- and "Post existing invoices" picks everything up again. After 5 failed attempts an invoice goes to needs attention.
CREATE FUNCTION public.ledger_process_queue(p_org uuid DEFAULT NULL, p_limit integer DEFAULT 200)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE q record; v_processed integer := 0; v_failed integer := 0; v_dropped integer := 0; v_n integer; v_state text; v_label text;
BEGIN
  p_limit := LEAST(GREATEST(COALESCE(p_limit, 200), 1), 200);
  -- Companies that may not run: their rows go.
  WITH gone AS (
    DELETE FROM public.ledger_post_queue q2 WHERE (p_org IS NULL OR q2.organization_id = p_org)
       AND NOT public._ledger_auto_org_ready(q2.organization_id) RETURNING 1)
  SELECT count(*) INTO v_dropped FROM gone;
  FOR q IN SELECT q3.organization_id, q3.source_id, max(q3.id) AS last_id, max(q3.attempts) AS attempts
             FROM public.ledger_post_queue q3 WHERE p_org IS NULL OR q3.organization_id = p_org
            GROUP BY q3.organization_id, q3.source_id ORDER BY min(q3.id) LIMIT p_limit LOOP
    BEGIN
      PERFORM public._ledger_auto_apply(q.organization_id, q.source_id);
      DELETE FROM public.ledger_post_queue WHERE organization_id = q.organization_id AND source_id = q.source_id AND id <= q.last_id;
      v_processed := v_processed + 1;
    EXCEPTION WHEN OTHERS THEN
      v_state := SQLSTATE;
      v_failed := v_failed + 1;
      IF q.attempts + 1 >= 5 THEN
        DELETE FROM public.ledger_post_queue WHERE organization_id = q.organization_id AND source_id = q.source_id AND id <= q.last_id;
        SELECT left(i.invoice_number, 120) INTO v_label FROM public.invoices i WHERE i.id = q.source_id;
        BEGIN
          PERFORM public._ledger_auto_issue(q.organization_id, q.source_id, v_label, 'invoice_issued', 'processing_failed');
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
      ELSE
        UPDATE public.ledger_post_queue SET attempts = q.attempts + 1, last_error = v_state
         WHERE organization_id = q.organization_id AND source_id = q.source_id AND id <= q.last_id;
      END IF;
    END;
  END LOOP;
  SELECT count(DISTINCT (organization_id, source_id)) INTO v_n FROM public.ledger_post_queue WHERE p_org IS NULL OR organization_id = p_org;
  RETURN jsonb_build_object('processed', v_processed, 'failed', v_failed, 'dropped', v_dropped, 'remaining', v_n);
END;
$function$;
REVOKE ALL ON FUNCTION public.ledger_process_queue(uuid, integer) FROM PUBLIC, anon, authenticated, service_role;

-- 5. What the screen calls.
CREATE FUNCTION public.ledger_auto_status(p_org uuid)
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
    'enabled_at', a.enabled_at,
    'waiting', (SELECT count(DISTINCT source_id) FROM public.ledger_post_queue q WHERE q.organization_id = p_org),
    'open_issues', (SELECT count(*) FROM public.ledger_post_issues i WHERE i.organization_id = p_org AND i.resolved_at IS NULL));
END;
$function$;

-- Switch on or off (owner or admin). Off stops new postings; it never deletes or reverses a journal.
CREATE FUNCTION public.ledger_auto_set(p_org uuid, p_enabled boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_was boolean;
BEGIN
  PERFORM public._ledger_require_writer(p_org);
  IF p_enabled IS NULL THEN RAISE EXCEPTION 'LEDGER_BAD_REQUEST' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ledger_settings s WHERE s.organization_id = p_org) THEN RAISE EXCEPTION 'LEDGER_NOT_SET_UP' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('ledger:' || p_org::text, 0));
  SELECT invoices_enabled INTO v_was FROM public.ledger_auto_settings WHERE organization_id = p_org;
  INSERT INTO public.ledger_auto_settings AS cur (organization_id, invoices_enabled, enabled_at, enabled_by, updated_at)
  VALUES (p_org, p_enabled, CASE WHEN p_enabled THEN now() END, CASE WHEN p_enabled THEN auth.uid() END, now())
  ON CONFLICT (organization_id) DO UPDATE SET invoices_enabled = EXCLUDED.invoices_enabled,
    enabled_at = CASE WHEN EXCLUDED.invoices_enabled AND NOT cur.invoices_enabled THEN now()
                      WHEN EXCLUDED.invoices_enabled THEN cur.enabled_at END,
    enabled_by = CASE WHEN EXCLUDED.invoices_enabled AND NOT cur.invoices_enabled THEN auth.uid()
                      WHEN EXCLUDED.invoices_enabled THEN cur.enabled_by END,
    updated_at = now();
  IF NOT p_enabled THEN DELETE FROM public.ledger_post_queue WHERE organization_id = p_org; END IF;
  IF v_was IS DISTINCT FROM p_enabled THEN
    INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, details)
    VALUES (auth.uid(), CASE WHEN p_enabled THEN 'ledger.auto_invoices_on' ELSE 'ledger.auto_invoices_off' END, 'ledger_auto_settings', p_org::text,
            jsonb_build_object('organization_id', p_org));
  END IF;
  RETURN public.ledger_auto_status(p_org);
END;
$function$;

-- What a catch-up would do now, without writing anything (members may look; amounts in whole pence).
CREATE FUNCTION public.ledger_auto_preview(p_org uuid)
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
    'to_reverse', v_rev, 'already_posted', v_done, 'not_issued', v_none, 'skipped', v_skip);
END;
$function$;

-- Post existing invoices: queue every invoice of the company and run the first batch (at most 200) straight away; the
-- rest follow on the next runs (pg_cron, or "Post now").
CREATE FUNCTION public.ledger_auto_catch_up(p_org uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_n integer; v_run jsonb;
BEGIN
  PERFORM public._ledger_require_writer(p_org);
  IF NOT EXISTS (SELECT 1 FROM public.ledger_auto_settings a WHERE a.organization_id = p_org AND a.invoices_enabled) THEN
    RAISE EXCEPTION 'LEDGER_AUTO_OFF' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.ledger_post_queue (organization_id, source_table, source_id)
  SELECT p_org, 'invoices', x.id FROM (SELECT i.id FROM public.invoices i WHERE i.organization_id = p_org
                                       UNION SELECT p.source_id FROM public.ledger_postings p WHERE p.organization_id = p_org AND p.reversed_at IS NULL) x
   WHERE NOT EXISTS (SELECT 1 FROM public.ledger_post_queue q WHERE q.organization_id = p_org AND q.source_id = x.id);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_run := public.ledger_process_queue(p_org, 200);
  RETURN jsonb_build_object('queued', v_n) || v_run;
END;
$function$;

-- Post now: one batch of this company's waiting invoices (owner or admin).
CREATE FUNCTION public.ledger_auto_run(p_org uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  PERFORM public._ledger_require_writer(p_org);
  IF NOT EXISTS (SELECT 1 FROM public.ledger_auto_settings a WHERE a.organization_id = p_org AND a.invoices_enabled) THEN
    RAISE EXCEPTION 'LEDGER_AUTO_OFF' USING ERRCODE = '22023';
  END IF;
  RETURN public.ledger_process_queue(p_org, 200);
END;
$function$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.ledger_auto_status(uuid)', 'public.ledger_auto_set(uuid,boolean)', 'public.ledger_auto_preview(uuid)',
    'public.ledger_auto_catch_up(uuid)', 'public.ledger_auto_run(uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
END $$;

DO $$
BEGIN
  IF has_table_privilege('authenticated', 'public.ledger_postings', 'INSERT') OR has_table_privilege('authenticated', 'public.ledger_auto_settings', 'UPDATE')
     OR has_table_privilege('service_role', 'public.ledger_post_issues', 'DELETE') OR has_table_privilege('anon', 'public.ledger_post_queue', 'SELECT')
     OR has_function_privilege('authenticated', 'public.ledger_process_queue(uuid,integer)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public._ledger_auto_apply(uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.ledger_auto_set(uuid,boolean)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.ledger_auto_catch_up(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'privileges are not as intended';
  END IF;
END $$;

COMMIT;
