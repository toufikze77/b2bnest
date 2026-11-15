-- =====================================================================================================================
-- Finance phase 3c-1: bank statement import and matching. PREPARED, NOT APPLIED.
-- Read docs/ledger-bank/README.md first. One transaction.
--
-- What it does: a company imports its bank statement (the browser reads the CSV; only the parsed rows arrive here) and
-- each statement line is MATCHED to a payment the ledger already posted to the Bank account (phases 3a/3b: postings of
-- kind invoice_paid, bill_paid, expense). Nothing is ever posted: no journal, no posting, no change to any existing
-- table, trigger or function. Lines that match nothing stay "unmatched" until phase 3c-2 lets them be posted.
--
-- New: tables ledger_bank_accounts, ledger_bank_imports, ledger_bank_lines (RLS on, members read, no write grants);
--  internal helpers _ledger_bank_guard (trigger), _ledger_bank_audit, _ledger_bank_try_date, _ledger_bank_posting_pence,
--  _ledger_bank_open_payments, _ledger_bank_match_run; RPCs ledger_bank_account_save, ledger_bank_import,
--  ledger_bank_match_run, ledger_bank_match, ledger_bank_unmatch, ledger_bank_ignore, ledger_bank_unignore,
--  ledger_bank_overview. The old per-user bank_accounts / bank_transactions tables are not touched or read.
--
-- Production facts (15 Nov 2026, read read-only by the owner's assistant): 157 tables in public (md5 of the sorted names
-- e8b4d718206034884fa5766884b831d5), ledger_postings.lp_kind as below, and md5(prosrc) of the functions below as
-- production stores them (a body is accepted raw, without whole-line comments, or without any '--' comment).
-- THE OWNER'S ASSISTANT RE-VERIFIES THESE BEFORE APPLYING; anything else: refused.
-- Rollback: docs/ledger-bank/rollback.sql (refuses while any statement line exists). Tests: docs/ledger-bank/run-test.sh.
-- =====================================================================================================================
BEGIN;

DO $$
DECLARE r record; v text;
BEGIN
  IF to_regclass('public.ledger_bank_lines') IS NOT NULL OR to_regclass('public.ledger_bank_accounts') IS NOT NULL
     OR to_regclass('public.ledger_bank_imports') IS NOT NULL THEN
    RAISE EXCEPTION 'Finance phase 3c-1 bank tables already exist (applied twice?)';
  END IF;
  IF (SELECT md5(string_agg(relname, ',' ORDER BY relname)) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind IN ('r', 'p'))
     IS DISTINCT FROM 'e8b4d718206034884fa5766884b831d5' THEN
    RAISE EXCEPTION 'the tables in public differ from production as read on 15 Nov 2026 (157 tables)';
  END IF;
  FOR r IN SELECT fn, array_agg(h) AS hs FROM (VALUES
      ('public._ledger_rule(uuid,uuid)', 'edf2117e8b0bdeb3826552b712faa227'),
      ('public._ledger_org_open(uuid)', '361077573d6cc7f9c83c6702808d61cd'),
      ('public._ledger_require_writer(uuid)', '75ecf4a981581daae33e90dc554f01c4'),
      ('public.require_aal2_if_enrolled()', '10b2ae7bd2f9a94ea20598f19b8aebf2'),
      ('public.user_is_organization_member(uuid,uuid)', '1fb55538d44b2451875f8baf1b6e4388'),
      ('public.demo_readonly_guard()', '087b5fe2695b95b8ba2ba6eb195ba995'),
      ('public._data_rights_gate_is_open(text)', 'b22b22eda6bd86e8ff363a6a58bfe3a3'),
      ('public._data_rights_closed_company_guard()', '2ec2d8630e284aed65d010c61a442a53'),
      ('public._data_rights_company_tables()', 'c4497fd5fa0245618d1168f9c19bffe1'),
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
  SELECT pg_get_constraintdef(oid) INTO v FROM pg_constraint WHERE conrelid = 'public.ledger_postings'::regclass AND conname = 'lp_kind';
  IF v IS DISTINCT FROM 'CHECK ((kind = ANY (ARRAY[''invoice_issued''::text, ''invoice_paid''::text, ''bill_received''::text, ''bill_paid''::text, ''expense''::text])))' THEN
    RAISE EXCEPTION 'ledger_postings.lp_kind differs from phase 3b (%)', v;
  END IF;
  -- The columns this reads (types as phases 2 and 3a created them).
  SELECT string_agg(c.relname || '.' || a.attname || ':' || format_type(a.atttypid, a.atttypmod), ',' ORDER BY c.relname, a.attname) INTO v
    FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
   WHERE c.relnamespace = 'public'::regnamespace AND NOT a.attisdropped
     AND ((c.relname = 'ledger_postings' AND a.attname IN ('id', 'organization_id', 'kind', 'entry_id', 'reversed_at', 'source_label'))
       OR (c.relname = 'journal_lines' AND a.attname IN ('entry_id', 'account_id', 'debit', 'credit'))
       OR (c.relname = 'journal_entries' AND a.attname IN ('id', 'organization_id', 'entry_date'))
       OR (c.relname = 'ledger_accounts' AND a.attname IN ('id', 'organization_id', 'system_key'))
       OR (c.relname = 'audit_logs' AND a.attname IN ('user_id', 'action', 'resource_type', 'resource_id', 'details')));
  IF v IS DISTINCT FROM 'audit_logs.action:text,audit_logs.details:jsonb,audit_logs.resource_id:text,audit_logs.resource_type:text,audit_logs.user_id:uuid,'
     || 'journal_entries.entry_date:date,journal_entries.id:uuid,journal_entries.organization_id:uuid,journal_lines.account_id:uuid,journal_lines.credit:numeric(14,2),'
     || 'journal_lines.debit:numeric(14,2),journal_lines.entry_id:uuid,ledger_accounts.id:uuid,ledger_accounts.organization_id:uuid,ledger_accounts.system_key:text,'
     || 'ledger_postings.entry_id:uuid,ledger_postings.id:uuid,ledger_postings.kind:text,ledger_postings.organization_id:uuid,ledger_postings.reversed_at:timestamp with time zone,'
     || 'ledger_postings.source_label:text' THEN
    RAISE EXCEPTION 'the ledger or audit columns differ from what this was written against (%)', v;
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. Tables. Written only by the functions below; members read (RLS); nothing is ever deleted except by a company close.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE public.ledger_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL CONSTRAINT lba_name CHECK (length(name) BETWEEN 1 AND 80 AND name = btrim(name)),
  -- Only the last four digits, never a full account number or sort code.
  last4 text CONSTRAINT lba_last4 CHECK (last4 IS NULL OR last4 ~ '^[0-9]{4}$'),
  currency text NOT NULL DEFAULT 'GBP' CONSTRAINT lba_currency CHECK (currency = 'GBP'),
  -- v1: always the company's Bank account (system_key 'bank'), checked by the guard trigger.
  ledger_account_id uuid NOT NULL REFERENCES public.ledger_accounts(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lba_id_org UNIQUE (id, organization_id)
);
CREATE UNIQUE INDEX ledger_bank_accounts_name ON public.ledger_bank_accounts (organization_id, lower(name));
COMMENT ON TABLE public.ledger_bank_accounts IS 'Finance phase 3c-1: a company''s bank accounts for statement import (name and last four digits only). Written only by ledger_bank_account_save. created_by is an opaque id (no foreign key).';

CREATE TABLE public.ledger_bank_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  bank_account_id uuid NOT NULL,
  file_name text CONSTRAINT lbi_file_name CHECK (file_name IS NULL OR (length(file_name) BETWEEN 1 AND 120 AND file_name = btrim(file_name))),
  file_hash text NOT NULL CONSTRAINT lbi_file_hash CHECK (file_hash ~ '^[0-9a-f]{32}$'),
  row_count integer NOT NULL CONSTRAINT lbi_row_count CHECK (row_count BETWEEN 1 AND 2000),
  first_date date NOT NULL,
  last_date date NOT NULL,
  -- The file lists the newest line first (so, within one day, the first row is the latest balance).
  newest_first boolean NOT NULL DEFAULT false,
  imported_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lbi_dates CHECK (first_date <= last_date),
  CONSTRAINT lbi_id_org_account UNIQUE (id, organization_id, bank_account_id),
  CONSTRAINT lbi_account FOREIGN KEY (bank_account_id, organization_id) REFERENCES public.ledger_bank_accounts (id, organization_id) ON DELETE CASCADE
);
CREATE INDEX ledger_bank_imports_account ON public.ledger_bank_imports (bank_account_id, file_hash);
COMMENT ON TABLE public.ledger_bank_imports IS 'Finance phase 3c-1: one row per statement import call (no file is stored). Written only by ledger_bank_import. imported_by is an opaque id.';

CREATE TABLE public.ledger_bank_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  bank_account_id uuid NOT NULL,
  import_id uuid NOT NULL,
  row_no integer NOT NULL CONSTRAINT lbl_row_no CHECK (row_no BETWEEN 1 AND 2000),
  line_date date NOT NULL CONSTRAINT lbl_line_date CHECK (line_date >= DATE '2000-01-01'),
  description text NOT NULL CONSTRAINT lbl_description CHECK (length(description) BETWEEN 1 AND 500),
  -- Signed whole pence: money in is positive, money out negative, never zero.
  amount_pence bigint NOT NULL CONSTRAINT lbl_amount CHECK (amount_pence <> 0 AND abs(amount_pence) < 100000000000000),
  balance_pence bigint CONSTRAINT lbl_balance CHECK (balance_pence IS NULL OR abs(balance_pence) < 100000000000000),
  external_ref text CONSTRAINT lbl_ref CHECK (external_ref IS NULL OR length(external_ref) BETWEEN 1 AND 100),
  dedupe_hash text NOT NULL CONSTRAINT lbl_dedupe_hash CHECK (dedupe_hash ~ '^[0-9a-f]{32}$'),
  -- 3c-2 will add 'posted' to this list.
  status text NOT NULL DEFAULT 'unmatched' CONSTRAINT lbl_status CHECK (status IN ('unmatched', 'matched', 'ignored')),
  matched_posting_id uuid REFERENCES public.ledger_postings(id) ON DELETE CASCADE,
  match_kind text CONSTRAINT lbl_match_kind CHECK (match_kind IS NULL OR match_kind IN ('auto', 'manual')),
  matched_by uuid,
  matched_at timestamptz,
  ignore_reason text CONSTRAINT lbl_ignore_reason CHECK (ignore_reason IS NULL OR ignore_reason IN ('not_business', 'handle_later')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lbl_state CHECK (
       (status = 'unmatched' AND matched_posting_id IS NULL AND match_kind IS NULL AND matched_by IS NULL AND matched_at IS NULL AND ignore_reason IS NULL)
    OR (status = 'matched' AND matched_posting_id IS NOT NULL AND match_kind IS NOT NULL AND matched_at IS NOT NULL AND ignore_reason IS NULL)
    OR (status = 'ignored' AND ignore_reason IS NOT NULL AND matched_posting_id IS NULL AND match_kind IS NULL AND matched_by IS NULL AND matched_at IS NULL)),
  CONSTRAINT lbl_dedupe UNIQUE (bank_account_id, dedupe_hash),
  CONSTRAINT lbl_account FOREIGN KEY (bank_account_id, organization_id) REFERENCES public.ledger_bank_accounts (id, organization_id) ON DELETE CASCADE,
  CONSTRAINT lbl_import FOREIGN KEY (import_id, organization_id, bank_account_id) REFERENCES public.ledger_bank_imports (id, organization_id, bank_account_id) ON DELETE CASCADE
);
-- A payment is matched by at most one statement line.
CREATE UNIQUE INDEX ledger_bank_lines_one_per_posting ON public.ledger_bank_lines (matched_posting_id) WHERE matched_posting_id IS NOT NULL;
CREATE INDEX ledger_bank_lines_account_status ON public.ledger_bank_lines (bank_account_id, status, line_date);
CREATE INDEX ledger_bank_lines_org_status ON public.ledger_bank_lines (organization_id, status);
CREATE INDEX ledger_bank_lines_import ON public.ledger_bank_lines (import_id);
COMMENT ON TABLE public.ledger_bank_lines IS 'Finance phase 3c-1: imported bank statement lines and what each matched. Date, amount and description never change after import; only the status and match fields, through the ledger_bank_* functions. matched_by is an opaque id.';

-- Append-only in spirit: nothing is deleted (except by a company close, through the P7b gate); an import is never edited;
-- a line's imported facts never change; a bank account keeps its company, ledger account and currency.
CREATE FUNCTION public._ledger_bank_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE v_kind text; v_org uuid;
BEGIN
  IF TG_OP = 'TRUNCATE' THEN RAISE EXCEPTION 'LEDGER_APPEND_ONLY: bank statement records are never removed' USING ERRCODE = '42501'; END IF;
  IF TG_OP = 'DELETE' THEN
    IF public._data_rights_gate_is_open('company_close') THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'LEDGER_APPEND_ONLY: bank statement records are never deleted' USING ERRCODE = '42501';
  END IF;
  IF TG_TABLE_NAME = 'ledger_bank_accounts' THEN
    IF TG_OP = 'UPDATE' AND (NEW.id, NEW.organization_id, NEW.ledger_account_id, NEW.currency, NEW.created_by, NEW.created_at)
        IS DISTINCT FROM (OLD.id, OLD.organization_id, OLD.ledger_account_id, OLD.currency, OLD.created_by, OLD.created_at) THEN
      RAISE EXCEPTION 'LEDGER_APPEND_ONLY: only a bank account''s name, last four digits and active flag change' USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.ledger_accounts a WHERE a.id = NEW.ledger_account_id AND a.organization_id = NEW.organization_id AND a.system_key = 'bank') THEN
      RAISE EXCEPTION 'LEDGER_BANK_NOT_BANK_ACCOUNT' USING ERRCODE = '22023';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'ledger_bank_imports' THEN
    IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'LEDGER_APPEND_ONLY: an import is never edited' USING ERRCODE = '42501'; END IF;
    RETURN NEW;
  END IF;
  -- ledger_bank_lines
  IF TG_OP = 'INSERT' AND NEW.status <> 'unmatched' THEN RAISE EXCEPTION 'LEDGER_APPEND_ONLY: a line is imported unmatched' USING ERRCODE = '42501'; END IF;
  IF TG_OP = 'UPDATE' AND (to_jsonb(NEW) - ARRAY['status', 'matched_posting_id', 'match_kind', 'matched_by', 'matched_at', 'ignore_reason'])
                          IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status', 'matched_posting_id', 'match_kind', 'matched_by', 'matched_at', 'ignore_reason']) THEN
    RAISE EXCEPTION 'LEDGER_APPEND_ONLY: an imported line''s date, amount and description never change' USING ERRCODE = '42501';
  END IF;
  IF NEW.matched_posting_id IS NOT NULL AND NEW.matched_posting_id IS DISTINCT FROM (CASE WHEN TG_OP = 'UPDATE' THEN OLD.matched_posting_id END) THEN
    SELECT p.kind, p.organization_id INTO v_kind, v_org FROM public.ledger_postings p WHERE p.id = NEW.matched_posting_id;
    IF v_org IS DISTINCT FROM NEW.organization_id OR v_kind NOT IN ('invoice_paid', 'bill_paid', 'expense') THEN
      RAISE EXCEPTION 'LEDGER_BANK_NOT_A_PAYMENT' USING ERRCODE = '22023';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public._ledger_bank_guard() FROM PUBLIC, anon, authenticated, service_role;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ledger_bank_accounts', 'ledger_bank_imports', 'ledger_bank_lines'] LOOP
    EXECUTE format('CREATE TRIGGER ledger_bank_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public._ledger_bank_guard()', t);
    EXECUTE format('CREATE TRIGGER ledger_bank_no_truncate BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public._ledger_bank_guard()', t);
    EXECUTE format('CREATE TRIGGER data_rights_closed_company BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public._data_rights_closed_company_guard(''organization_id'')', t);
    EXECUTE format('CREATE TRIGGER a0_demo_readonly_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.demo_readonly_guard()', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated, service_role', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated, service_role', t);
    EXECUTE format('CREATE POLICY "Company members can read bank statements" ON public.%I FOR SELECT TO authenticated
      USING (public.user_is_organization_member(organization_id, (SELECT auth.uid())))', t);
    EXECUTE format('CREATE POLICY require_aal2_if_enrolled ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()))', t);
    EXECUTE format('CREATE POLICY ledger_hide_closed ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (public._ledger_org_open(organization_id))', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. Internal helpers (no grants).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public._ledger_bank_audit(p_action text, p_resource text, p_id uuid, p_details jsonb)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, details) VALUES ((SELECT auth.uid()), p_action, p_resource, p_id::text, p_details);
$function$;

-- 'YYYY-MM-DD' to a date, or NULL (never an error).
CREATE FUNCTION public._ledger_bank_try_date(p text)
 RETURNS date
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
DECLARE v date;
BEGIN
  IF p IS NULL OR p !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RETURN NULL; END IF;
  v := to_date(p, 'YYYY-MM-DD');
  RETURN CASE WHEN to_char(v, 'YYYY-MM-DD') = p THEN v END; -- 2026-02-30 is not a date
EXCEPTION WHEN others THEN RETURN NULL;
END;
$function$;

-- A journal's movement on one ledger account, in signed pence (debit = money into the bank). Read from the journal lines.
CREATE FUNCTION public._ledger_bank_posting_pence(p_entry uuid, p_account uuid)
 RETURNS bigint
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT sum((l.debit * 100)::bigint - (l.credit * 100)::bigint)::bigint FROM public.journal_lines l WHERE l.entry_id = p_entry AND l.account_id = p_account;
$function$;

-- The company's live payments on its Bank account that no statement line has matched yet.
CREATE FUNCTION public._ledger_bank_open_payments(p_org uuid, p_account uuid)
 RETURNS TABLE(posting_id uuid, kind text, source_label text, entry_date date, bank_pence bigint)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT p.id, p.kind, p.source_label, e.entry_date, x.pence
    FROM public.ledger_postings p
    JOIN public.journal_entries e ON e.id = p.entry_id AND e.organization_id = p_org
    CROSS JOIN LATERAL (SELECT public._ledger_bank_posting_pence(p.entry_id, p_account) AS pence) x
   WHERE p.organization_id = p_org AND p.reversed_at IS NULL AND p.kind IN ('invoice_paid', 'bill_paid', 'expense')
     AND x.pence IS NOT NULL AND x.pence <> 0
     AND ((p.kind = 'invoice_paid' AND x.pence > 0) OR (p.kind <> 'invoice_paid' AND x.pence < 0))
     AND NOT EXISTS (SELECT 1 FROM public.ledger_bank_lines b WHERE b.matched_posting_id = p.id);
$function$;

-- The matcher (caller holds the company lock and has checked the person).
--  1. A line whose matched payment has since been reversed loses the link (audit row, reason posting_reversed).
--  2. Each unmatched line of this account is matched when exactly one open payment has the same signed amount on the
--     Bank account within 7 days AND that payment fits no other unmatched line of the company. Anything else is left.
CREATE FUNCTION public._ledger_bank_match_run(p_org uuid, p_bank_account uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_acc public.ledger_bank_accounts; r record; v_unlinked integer := 0; v_matched integer := 0;
BEGIN
  SELECT * INTO v_acc FROM public.ledger_bank_accounts a WHERE a.id = p_bank_account AND a.organization_id = p_org;
  IF NOT FOUND THEN RAISE EXCEPTION 'LEDGER_NOT_FOUND' USING ERRCODE = '22023'; END IF;
  FOR r IN SELECT b.id, b.matched_posting_id FROM public.ledger_bank_lines b JOIN public.ledger_postings p ON p.id = b.matched_posting_id
            WHERE b.organization_id = p_org AND b.bank_account_id = p_bank_account AND b.status = 'matched' AND p.reversed_at IS NOT NULL
            ORDER BY b.line_date, b.id LOOP
    UPDATE public.ledger_bank_lines SET status = 'unmatched', matched_posting_id = NULL, match_kind = NULL, matched_by = NULL, matched_at = NULL WHERE id = r.id;
    PERFORM public._ledger_bank_audit('ledger.bank_unmatch', 'ledger_bank_lines', r.id,
      jsonb_build_object('organization_id', p_org, 'bank_account_id', p_bank_account, 'posting_id', r.matched_posting_id, 'reason', 'posting_reversed'));
    v_unlinked := v_unlinked + 1;
  END LOOP;
  FOR r IN
    WITH pay AS (SELECT * FROM public._ledger_bank_open_payments(p_org, v_acc.ledger_account_id)),
         ln AS (SELECT b.id, b.bank_account_id, b.line_date, b.amount_pence FROM public.ledger_bank_lines b
                  JOIN public.ledger_bank_accounts a ON a.id = b.bank_account_id AND a.ledger_account_id = v_acc.ledger_account_id
                 WHERE b.organization_id = p_org AND b.status = 'unmatched'),
         pr AS (SELECT ln.id AS line_id, ln.bank_account_id, pay.posting_id FROM ln JOIN pay ON pay.bank_pence = ln.amount_pence
                 WHERE abs(pay.entry_date - ln.line_date) <= 7),
         n AS (SELECT pr.*, count(*) OVER (PARTITION BY pr.line_id) AS per_line, count(*) OVER (PARTITION BY pr.posting_id) AS per_payment FROM pr)
    SELECT n.line_id, n.posting_id FROM n WHERE n.per_line = 1 AND n.per_payment = 1 AND n.bank_account_id = p_bank_account ORDER BY n.line_id
  LOOP
    UPDATE public.ledger_bank_lines SET status = 'matched', matched_posting_id = r.posting_id, match_kind = 'auto', matched_by = (SELECT auth.uid()), matched_at = now()
     WHERE id = r.line_id AND status = 'unmatched';
    PERFORM public._ledger_bank_audit('ledger.bank_match', 'ledger_bank_lines', r.line_id,
      jsonb_build_object('organization_id', p_org, 'bank_account_id', p_bank_account, 'posting_id', r.posting_id, 'how', 'auto'));
    v_matched := v_matched + 1;
  END LOOP;
  RETURN jsonb_build_object('matched', v_matched, 'unlinked', v_unlinked);
END;
$function$;

REVOKE ALL ON FUNCTION public._ledger_bank_audit(text, text, uuid, jsonb), public._ledger_bank_try_date(text), public._ledger_bank_posting_pence(uuid, uuid),
  public._ledger_bank_open_payments(uuid, uuid), public._ledger_bank_match_run(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. RPCs. Writers: the ledger's managers (_ledger_require_writer: MFA rule, plan, demo, closed company); one company
--    lock per write; one audit row per real change.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.ledger_bank_account_save(p_org uuid, p_id uuid, p_name text, p_last4 text DEFAULT NULL, p_active boolean DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_name text := btrim(p_name); v_last4 text := NULLIF(btrim(p_last4), ''); v_bank uuid; a public.ledger_bank_accounts; v_id uuid;
BEGIN
  PERFORM public._ledger_require_writer(p_org);
  IF v_name IS NULL OR length(v_name) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'LEDGER_BANK_BAD_NAME' USING ERRCODE = '22023'; END IF;
  IF v_last4 IS NOT NULL AND v_last4 !~ '^[0-9]{4}$' THEN RAISE EXCEPTION 'LEDGER_BANK_BAD_LAST4' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('ledger:' || p_org::text, 0));
  SELECT l.id INTO v_bank FROM public.ledger_accounts l WHERE l.organization_id = p_org AND l.system_key = 'bank';
  IF v_bank IS NULL OR NOT EXISTS (SELECT 1 FROM public.ledger_settings s WHERE s.organization_id = p_org) THEN
    RAISE EXCEPTION 'LEDGER_NOT_SET_UP' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.ledger_bank_accounts x WHERE x.organization_id = p_org AND lower(x.name) = lower(v_name) AND x.id IS DISTINCT FROM p_id) THEN
    RAISE EXCEPTION 'LEDGER_BANK_NAME_TAKEN' USING ERRCODE = '22023';
  END IF;
  IF p_id IS NULL THEN
    IF (SELECT count(*) FROM public.ledger_bank_accounts x WHERE x.organization_id = p_org) >= 10 THEN
      RAISE EXCEPTION 'LEDGER_BANK_ACCOUNT_LIMIT' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.ledger_bank_accounts (organization_id, name, last4, ledger_account_id, is_active, created_by)
    VALUES (p_org, v_name, v_last4, v_bank, COALESCE(p_active, true), (SELECT auth.uid())) RETURNING id INTO v_id;
    PERFORM public._ledger_bank_audit('ledger.bank_account_create', 'ledger_bank_accounts', v_id,
      jsonb_build_object('organization_id', p_org, 'name', v_name, 'last4', v_last4, 'is_active', COALESCE(p_active, true)));
    RETURN jsonb_build_object('result', 'created', 'id', v_id);
  END IF;
  SELECT * INTO a FROM public.ledger_bank_accounts x WHERE x.id = p_id AND x.organization_id = p_org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'LEDGER_NOT_FOUND' USING ERRCODE = '22023'; END IF;
  IF (a.name, a.last4, a.is_active) IS NOT DISTINCT FROM (v_name, v_last4, COALESCE(p_active, a.is_active)) THEN
    RETURN jsonb_build_object('result', 'unchanged', 'id', a.id);
  END IF;
  UPDATE public.ledger_bank_accounts SET name = v_name, last4 = v_last4, is_active = COALESCE(p_active, a.is_active) WHERE id = a.id;
  PERFORM public._ledger_bank_audit('ledger.bank_account_update', 'ledger_bank_accounts', a.id,
    jsonb_build_object('organization_id', p_org, 'name', v_name, 'last4', v_last4, 'is_active', COALESCE(p_active, a.is_active)));
  RETURN jsonb_build_object('result', 'updated', 'id', a.id);
END;
$function$;

-- p_rows: [{date 'YYYY-MM-DD', description, amount_pence (signed integer), balance_pence (optional), ref (optional),
-- seq (optional: this row's number among identical rows in the whole file, when the browser sends a file in chunks)}].
-- All or nothing: any invalid row and nothing is imported (the answer lists the first 50 problems). Rows already
-- imported (same dedupe hash) are skipped. Then the matcher runs.
CREATE FUNCTION public.ledger_bank_import(p_org uuid, p_bank_account uuid, p_file_name text, p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE a public.ledger_bank_accounts; v_n integer; v_bad integer; v_problems jsonb; v_file text; v_hash text; v_first date; v_last date;
  v_newest boolean; v_before boolean; v_import uuid; v_imported integer; v_match jsonb;
BEGIN
  PERFORM public._ledger_require_writer(p_org);
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN RAISE EXCEPTION 'LEDGER_BAD_REQUEST' USING ERRCODE = '22023'; END IF;
  v_n := jsonb_array_length(p_rows);
  IF v_n > 2000 THEN RAISE EXCEPTION 'LEDGER_BANK_TOO_MANY_ROWS' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('ledger:' || p_org::text, 0));
  SELECT * INTO a FROM public.ledger_bank_accounts x WHERE x.id = p_bank_account AND x.organization_id = p_org;
  IF NOT FOUND THEN RAISE EXCEPTION 'LEDGER_NOT_FOUND' USING ERRCODE = '22023'; END IF;
  IF NOT a.is_active THEN RAISE EXCEPTION 'LEDGER_BANK_ACCOUNT_INACTIVE' USING ERRCODE = '22023'; END IF;
  v_file := NULLIF(left(btrim(COALESCE(p_file_name, '')), 120), '');
  v_file := NULLIF(btrim(v_file), '');

  CREATE TEMP TABLE IF NOT EXISTS ledger_bank_rows (row_no integer, d date, description text, amount bigint, balance bigint, ref text, seq integer, problem text) ON COMMIT DROP;
  TRUNCATE pg_temp.ledger_bank_rows;
  INSERT INTO pg_temp.ledger_bank_rows
  SELECT t.o::integer, v.d, v.descr, CASE WHEN v.problem IS NULL THEN v.amt::bigint END, CASE WHEN v.problem IS NULL THEN v.bal::bigint END, v.ref,
         CASE WHEN v.problem IS NULL THEN v.seq::integer END, v.problem
    FROM jsonb_array_elements(p_rows) WITH ORDINALITY t(r, o)
    CROSS JOIN LATERAL (
      SELECT x.d, x.descr, x.amt, x.bal, x.ref, x.seq,
        CASE
          WHEN jsonb_typeof(t.r) <> 'object' THEN 'not_a_row'
          WHEN x.d IS NULL THEN 'bad_date'
          WHEN x.d < DATE '2000-01-01' OR x.d > current_date + 1 THEN 'date_out_of_range'
          WHEN jsonb_typeof(t.r -> 'amount_pence') IS DISTINCT FROM 'number' THEN 'amount_missing'
          WHEN x.amt <> trunc(x.amt) THEN 'amount_not_whole_pence'
          WHEN x.amt = 0 THEN 'amount_zero'
          WHEN abs(x.amt) >= 100000000000000 THEN 'amount_too_large'
          WHEN jsonb_typeof(t.r -> 'balance_pence') NOT IN ('number', 'null') THEN 'bad_balance'
          WHEN x.bal IS NOT NULL AND (x.bal <> trunc(x.bal) OR abs(x.bal) >= 100000000000000) THEN 'bad_balance'
          WHEN jsonb_typeof(t.r -> 'description') IS DISTINCT FROM 'string' OR x.descr IS NULL OR length(x.descr) > 500 THEN 'bad_description'
          WHEN jsonb_typeof(t.r -> 'ref') NOT IN ('string', 'null') OR length(x.ref) > 100 THEN 'bad_reference'
          WHEN jsonb_typeof(t.r -> 'seq') NOT IN ('number', 'null') THEN 'bad_sequence'
          WHEN x.seq IS NOT NULL AND (x.seq <> trunc(x.seq) OR x.seq < 1 OR x.seq > 100000) THEN 'bad_sequence'
        END AS problem
        FROM (SELECT public._ledger_bank_try_date(CASE WHEN jsonb_typeof(t.r) = 'object' AND jsonb_typeof(t.r -> 'date') = 'string' THEN t.r ->> 'date' END) AS d,
                     NULLIF(regexp_replace(btrim(CASE WHEN jsonb_typeof(t.r) = 'object' AND jsonb_typeof(t.r -> 'description') = 'string' THEN t.r ->> 'description' END), '\s+', ' ', 'g'), '') AS descr,
                     CASE WHEN jsonb_typeof(t.r) = 'object' AND jsonb_typeof(t.r -> 'amount_pence') = 'number' THEN (t.r ->> 'amount_pence')::numeric END AS amt,
                     CASE WHEN jsonb_typeof(t.r) = 'object' AND jsonb_typeof(t.r -> 'balance_pence') = 'number' THEN (t.r ->> 'balance_pence')::numeric END AS bal,
                     NULLIF(regexp_replace(btrim(CASE WHEN jsonb_typeof(t.r) = 'object' AND jsonb_typeof(t.r -> 'ref') = 'string' THEN t.r ->> 'ref' END), '\s+', ' ', 'g'), '') AS ref,
                     CASE WHEN jsonb_typeof(t.r) = 'object' AND jsonb_typeof(t.r -> 'seq') = 'number' THEN (t.r ->> 'seq')::numeric END AS seq) x) v;

  SELECT count(*) FILTER (WHERE problem IS NOT NULL),
         COALESCE(jsonb_agg(jsonb_build_object('row', row_no, 'reason', problem) ORDER BY row_no) FILTER (WHERE problem IS NOT NULL), '[]'::jsonb)
    INTO v_bad, v_problems FROM pg_temp.ledger_bank_rows;
  IF v_bad > 0 THEN
    RETURN jsonb_build_object('result', 'rejected', 'imported', 0, 'skipped_duplicates', 0, 'rejected', v_bad,
      'problems', (SELECT COALESCE(jsonb_agg(e), '[]'::jsonb) FROM (SELECT e FROM jsonb_array_elements(v_problems) WITH ORDINALITY q(e, i) WHERE i <= 50) z));
  END IF;

  SELECT md5(string_agg(concat_ws('|', to_char(d, 'YYYY-MM-DD'), amount, description, COALESCE(ref, ''), COALESCE(balance::text, '')), E'\n' ORDER BY row_no)),
         min(d), max(d), (array_agg(d ORDER BY row_no))[1] > (array_agg(d ORDER BY row_no DESC))[1]
    INTO v_hash, v_first, v_last, v_newest FROM pg_temp.ledger_bank_rows;
  v_before := EXISTS (SELECT 1 FROM public.ledger_bank_imports i WHERE i.bank_account_id = p_bank_account AND i.file_hash = v_hash);
  INSERT INTO public.ledger_bank_imports (organization_id, bank_account_id, file_name, file_hash, row_count, first_date, last_date, newest_first, imported_by)
  VALUES (p_org, p_bank_account, v_file, v_hash, v_n, v_first, v_last, v_newest, (SELECT auth.uid())) RETURNING id INTO v_import;
  INSERT INTO public.ledger_bank_lines (organization_id, bank_account_id, import_id, row_no, line_date, description, amount_pence, balance_pence, external_ref, dedupe_hash)
  SELECT p_org, p_bank_account, v_import, w.row_no, w.d, w.description, w.amount, w.balance, w.ref,
         md5(concat_ws('|', 'v1', p_bank_account, to_char(w.d, 'YYYY-MM-DD'), w.amount, w.description, COALESCE(w.ref, ''), w.occ))
    FROM (SELECT r.*, COALESCE(r.seq, row_number() OVER (PARTITION BY r.d, r.amount, r.description, r.ref ORDER BY r.row_no)) AS occ FROM pg_temp.ledger_bank_rows r) w
   ORDER BY w.row_no
  ON CONFLICT ON CONSTRAINT lbl_dedupe DO NOTHING;
  GET DIAGNOSTICS v_imported = ROW_COUNT;
  PERFORM public._ledger_bank_audit('ledger.bank_import', 'ledger_bank_imports', v_import,
    jsonb_build_object('organization_id', p_org, 'bank_account_id', p_bank_account, 'rows', v_n, 'imported', v_imported, 'skipped_duplicates', v_n - v_imported,
                       'first_date', v_first, 'last_date', v_last, 'imported_before', v_before));
  v_match := public._ledger_bank_match_run(p_org, p_bank_account);
  RETURN jsonb_build_object('result', 'ok', 'import_id', v_import, 'imported', v_imported, 'skipped_duplicates', v_n - v_imported, 'rejected', 0,
    'problems', '[]'::jsonb, 'imported_before', v_before, 'matched', (v_match ->> 'matched')::integer, 'unlinked', (v_match ->> 'unlinked')::integer);
END;
$function$;

CREATE FUNCTION public.ledger_bank_match_run(p_org uuid, p_bank_account uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  PERFORM public._ledger_require_writer(p_org);
  PERFORM pg_advisory_xact_lock(hashtextextended('ledger:' || p_org::text, 0));
  RETURN public._ledger_bank_match_run(p_org, p_bank_account);
END;
$function$;

-- By hand: same signed amount on the Bank account; up to 31 days apart.
CREATE FUNCTION public.ledger_bank_match(p_org uuid, p_line uuid, p_posting uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE l public.ledger_bank_lines; p public.ledger_postings; v_date date; v_acc uuid; v_pence bigint;
BEGIN
  PERFORM public._ledger_require_writer(p_org);
  PERFORM pg_advisory_xact_lock(hashtextextended('ledger:' || p_org::text, 0));
  SELECT * INTO l FROM public.ledger_bank_lines x WHERE x.id = p_line AND x.organization_id = p_org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'LEDGER_NOT_FOUND' USING ERRCODE = '22023'; END IF;
  SELECT * INTO p FROM public.ledger_postings x WHERE x.id = p_posting AND x.organization_id = p_org;
  IF NOT FOUND THEN RAISE EXCEPTION 'LEDGER_NOT_FOUND' USING ERRCODE = '22023'; END IF;
  IF l.status = 'matched' OR EXISTS (SELECT 1 FROM public.ledger_bank_lines x WHERE x.matched_posting_id = p_posting) THEN
    RAISE EXCEPTION 'LEDGER_BANK_ALREADY_MATCHED' USING ERRCODE = '22023';
  END IF;
  IF l.status = 'ignored' THEN RAISE EXCEPTION 'LEDGER_BANK_IGNORED' USING ERRCODE = '22023'; END IF;
  IF p.kind NOT IN ('invoice_paid', 'bill_paid', 'expense') THEN RAISE EXCEPTION 'LEDGER_BANK_NOT_A_PAYMENT' USING ERRCODE = '22023'; END IF;
  IF p.reversed_at IS NOT NULL THEN RAISE EXCEPTION 'LEDGER_BANK_POSTING_REVERSED' USING ERRCODE = '22023'; END IF;
  SELECT a.ledger_account_id INTO v_acc FROM public.ledger_bank_accounts a WHERE a.id = l.bank_account_id;
  SELECT e.entry_date INTO v_date FROM public.journal_entries e WHERE e.id = p.entry_id;
  v_pence := public._ledger_bank_posting_pence(p.entry_id, v_acc);
  IF v_pence IS DISTINCT FROM l.amount_pence OR (p.kind = 'invoice_paid') <> (l.amount_pence > 0) THEN
    RAISE EXCEPTION 'LEDGER_BANK_AMOUNT_DIFFERS' USING ERRCODE = '22023';
  END IF;
  IF abs(v_date - l.line_date) > 31 THEN RAISE EXCEPTION 'LEDGER_BANK_TOO_FAR_APART' USING ERRCODE = '22023'; END IF;
  UPDATE public.ledger_bank_lines SET status = 'matched', matched_posting_id = p.id, match_kind = 'manual', matched_by = (SELECT auth.uid()), matched_at = now() WHERE id = l.id;
  PERFORM public._ledger_bank_audit('ledger.bank_match', 'ledger_bank_lines', l.id,
    jsonb_build_object('organization_id', p_org, 'bank_account_id', l.bank_account_id, 'posting_id', p.id, 'how', 'manual'));
  RETURN jsonb_build_object('result', 'matched', 'line_id', l.id, 'posting_id', p.id);
END;
$function$;

CREATE FUNCTION public.ledger_bank_unmatch(p_org uuid, p_line uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE l public.ledger_bank_lines;
BEGIN
  PERFORM public._ledger_require_writer(p_org);
  PERFORM pg_advisory_xact_lock(hashtextextended('ledger:' || p_org::text, 0));
  SELECT * INTO l FROM public.ledger_bank_lines x WHERE x.id = p_line AND x.organization_id = p_org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'LEDGER_NOT_FOUND' USING ERRCODE = '22023'; END IF;
  IF l.status <> 'matched' THEN RETURN jsonb_build_object('result', 'unchanged', 'line_id', l.id); END IF;
  UPDATE public.ledger_bank_lines SET status = 'unmatched', matched_posting_id = NULL, match_kind = NULL, matched_by = NULL, matched_at = NULL WHERE id = l.id;
  PERFORM public._ledger_bank_audit('ledger.bank_unmatch', 'ledger_bank_lines', l.id,
    jsonb_build_object('organization_id', p_org, 'bank_account_id', l.bank_account_id, 'posting_id', l.matched_posting_id, 'reason', 'by_hand'));
  RETURN jsonb_build_object('result', 'unmatched', 'line_id', l.id);
END;
$function$;

-- p_reason: 'not_business' (not a business transaction) or 'handle_later'. Ignored lines stay visible.
CREATE FUNCTION public.ledger_bank_ignore(p_org uuid, p_line uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE l public.ledger_bank_lines;
BEGIN
  PERFORM public._ledger_require_writer(p_org);
  IF p_reason IS NULL OR p_reason NOT IN ('not_business', 'handle_later') THEN RAISE EXCEPTION 'LEDGER_BAD_REQUEST' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('ledger:' || p_org::text, 0));
  SELECT * INTO l FROM public.ledger_bank_lines x WHERE x.id = p_line AND x.organization_id = p_org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'LEDGER_NOT_FOUND' USING ERRCODE = '22023'; END IF;
  IF l.status = 'matched' THEN RAISE EXCEPTION 'LEDGER_BANK_ALREADY_MATCHED' USING ERRCODE = '22023'; END IF;
  IF l.status = 'ignored' AND l.ignore_reason = p_reason THEN RETURN jsonb_build_object('result', 'unchanged', 'line_id', l.id); END IF;
  UPDATE public.ledger_bank_lines SET status = 'ignored', ignore_reason = p_reason WHERE id = l.id;
  PERFORM public._ledger_bank_audit('ledger.bank_ignore', 'ledger_bank_lines', l.id,
    jsonb_build_object('organization_id', p_org, 'bank_account_id', l.bank_account_id, 'reason', p_reason));
  RETURN jsonb_build_object('result', 'ignored', 'line_id', l.id);
END;
$function$;

CREATE FUNCTION public.ledger_bank_unignore(p_org uuid, p_line uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE l public.ledger_bank_lines;
BEGIN
  PERFORM public._ledger_require_writer(p_org);
  PERFORM pg_advisory_xact_lock(hashtextextended('ledger:' || p_org::text, 0));
  SELECT * INTO l FROM public.ledger_bank_lines x WHERE x.id = p_line AND x.organization_id = p_org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'LEDGER_NOT_FOUND' USING ERRCODE = '22023'; END IF;
  IF l.status <> 'ignored' THEN RETURN jsonb_build_object('result', 'unchanged', 'line_id', l.id); END IF;
  UPDATE public.ledger_bank_lines SET status = 'unmatched', ignore_reason = NULL WHERE id = l.id;
  PERFORM public._ledger_bank_audit('ledger.bank_unignore', 'ledger_bank_lines', l.id,
    jsonb_build_object('organization_id', p_org, 'bank_account_id', l.bank_account_id, 'was', l.ignore_reason));
  RETURN jsonb_build_object('result', 'unmatched', 'line_id', l.id);
END;
$function$;

-- Read only. Members read (the same people who can read the trial balance; the demo account reads its own company only).
CREATE FUNCTION public.ledger_bank_overview(p_org uuid, p_bank_account uuid DEFAULT NULL, p_as_at date DEFAULT NULL, p_page integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_rule text; v_as_at date := COALESCE(p_as_at, current_date); v_page integer := GREATEST(COALESCE(p_page, 0), 0);
  a public.ledger_bank_accounts; v_accounts jsonb; v_set_up boolean; v_ledger bigint; v_stmt record; v_from date; v_to date; v_out jsonb;
BEGIN
  PERFORM public.require_aal2_if_enrolled();
  v_rule := public._ledger_rule(p_org, auth.uid());
  IF v_rule IN ('not_signed_in', 'not_member', 'closed') THEN RAISE EXCEPTION 'LEDGER_%', upper(v_rule) USING ERRCODE = '42501'; END IF;
  IF v_rule = 'demo' AND NOT public.user_is_organization_member(p_org, auth.uid()) THEN RAISE EXCEPTION 'LEDGER_NOT_MEMBER' USING ERRCODE = '42501'; END IF;
  v_set_up := EXISTS (SELECT 1 FROM public.ledger_settings s WHERE s.organization_id = p_org);
  IF v_rule NOT IN ('ok', 'not_admin', 'demo') THEN
    RETURN jsonb_build_object('access', v_rule, 'can_manage', false, 'set_up', v_set_up, 'accounts', '[]'::jsonb);
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'last4', x.last4, 'is_active', x.is_active,
           'unmatched', (SELECT count(*) FROM public.ledger_bank_lines b WHERE b.bank_account_id = x.id AND b.status = 'unmatched'),
           'lines', (SELECT count(*) FROM public.ledger_bank_lines b WHERE b.bank_account_id = x.id)) ORDER BY x.created_at, x.id), '[]'::jsonb)
    INTO v_accounts FROM public.ledger_bank_accounts x WHERE x.organization_id = p_org;
  IF p_bank_account IS NOT NULL THEN
    SELECT * INTO a FROM public.ledger_bank_accounts x WHERE x.id = p_bank_account AND x.organization_id = p_org;
    IF NOT FOUND THEN RAISE EXCEPTION 'LEDGER_NOT_FOUND' USING ERRCODE = '22023'; END IF;
  ELSE
    SELECT * INTO a FROM public.ledger_bank_accounts x WHERE x.organization_id = p_org ORDER BY x.is_active DESC, x.created_at, x.id LIMIT 1;
  END IF;
  v_out := jsonb_build_object('access', 'ok', 'can_manage', v_rule = 'ok', 'set_up', v_set_up, 'accounts', v_accounts, 'as_at', v_as_at,
    'auto_window_days', 7, 'manual_window_days', 31, 'page_size', 200, 'page', v_page);
  IF a.id IS NULL THEN RETURN v_out || jsonb_build_object('bank_account_id', NULL); END IF;

  SELECT min(i.first_date), max(i.last_date) INTO v_from, v_to FROM public.ledger_bank_imports i WHERE i.bank_account_id = a.id;
  SELECT COALESCE(sum((l.debit * 100)::bigint - (l.credit * 100)::bigint), 0)::bigint INTO v_ledger
    FROM public.journal_lines l JOIN public.journal_entries e ON e.id = l.entry_id
   WHERE l.account_id = a.ledger_account_id AND e.organization_id = p_org AND e.entry_date <= v_as_at;
  SELECT b.balance_pence, b.line_date INTO v_stmt FROM public.ledger_bank_lines b JOIN public.ledger_bank_imports i ON i.id = b.import_id
   WHERE b.bank_account_id = a.id AND b.balance_pence IS NOT NULL AND b.line_date <= v_as_at
   ORDER BY b.line_date DESC, i.created_at DESC, CASE WHEN i.newest_first THEN b.row_no ELSE -b.row_no END LIMIT 1;

  RETURN v_out || (
    WITH pay AS (SELECT * FROM public._ledger_bank_open_payments(p_org, a.ledger_account_id)),
         lines AS (SELECT b.*, p.reversed_at AS posting_reversed_at, p.kind AS posting_kind, p.source_label AS posting_label, e.entry_date AS posting_date
                     FROM public.ledger_bank_lines b
                     LEFT JOIN public.ledger_postings p ON p.id = b.matched_posting_id
                     LEFT JOIN public.journal_entries e ON e.id = p.entry_id
                    WHERE b.bank_account_id = a.id)
    SELECT jsonb_build_object(
      'bank_account_id', a.id,
      'counts', jsonb_build_object(
        'unmatched', (SELECT count(*) FROM lines WHERE status = 'unmatched'),
        'matched', (SELECT count(*) FROM lines WHERE status = 'matched' AND posting_reversed_at IS NULL),
        'ignored', (SELECT count(*) FROM lines WHERE status = 'ignored'),
        'needs_attention', (SELECT count(*) FROM lines WHERE status = 'matched' AND posting_reversed_at IS NOT NULL)),
      'unmatched', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', u.id, 'line_date', u.line_date, 'description', u.description, 'amount_pence', u.amount_pence,
            'balance_pence', u.balance_pence, 'external_ref', u.external_ref,
            'suggestions', COALESCE((SELECT jsonb_agg(jsonb_build_object('posting_id', s.posting_id, 'kind', s.kind, 'source_label', s.source_label, 'entry_date', s.entry_date,
                 'amount_pence', s.bank_pence, 'days_apart', abs(s.entry_date - u.line_date)) ORDER BY abs(s.entry_date - u.line_date), s.entry_date, s.posting_id)
               FROM (SELECT * FROM pay WHERE pay.bank_pence = u.amount_pence AND abs(pay.entry_date - u.line_date) <= 31
                      ORDER BY abs(pay.entry_date - u.line_date), pay.entry_date, pay.posting_id LIMIT 3) s), '[]'::jsonb)) ORDER BY u.line_date DESC, u.row_no)
          FROM (SELECT * FROM lines WHERE status = 'unmatched' ORDER BY line_date DESC, row_no, id LIMIT 200 OFFSET v_page * 200) u), '[]'::jsonb),
      'matched', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', m.id, 'line_date', m.line_date, 'description', m.description, 'amount_pence', m.amount_pence,
            'match_kind', m.match_kind, 'matched_at', m.matched_at, 'posting_id', m.matched_posting_id, 'kind', m.posting_kind, 'source_label', m.posting_label,
            'entry_date', m.posting_date) ORDER BY m.line_date DESC, m.row_no)
          FROM (SELECT * FROM lines WHERE status = 'matched' AND posting_reversed_at IS NULL ORDER BY line_date DESC, row_no, id LIMIT 200) m), '[]'::jsonb),
      'ignored', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', g.id, 'line_date', g.line_date, 'description', g.description, 'amount_pence', g.amount_pence,
            'ignore_reason', g.ignore_reason) ORDER BY g.line_date DESC, g.row_no)
          FROM (SELECT * FROM lines WHERE status = 'ignored' ORDER BY line_date DESC, row_no, id LIMIT 200) g), '[]'::jsonb),
      'needs_attention', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', n.id, 'line_date', n.line_date, 'description', n.description, 'amount_pence', n.amount_pence,
            'reason', 'match_broken', 'posting_id', n.matched_posting_id, 'kind', n.posting_kind, 'source_label', n.posting_label, 'entry_date', n.posting_date)
            ORDER BY n.line_date DESC, n.row_no)
          FROM (SELECT * FROM lines WHERE status = 'matched' AND posting_reversed_at IS NOT NULL ORDER BY line_date DESC, row_no, id LIMIT 200) n), '[]'::jsonb),
      'unmatched_payments', CASE WHEN v_from IS NULL THEN '[]'::jsonb ELSE COALESCE((SELECT jsonb_agg(jsonb_build_object('posting_id', q.posting_id, 'kind', q.kind,
            'source_label', q.source_label, 'entry_date', q.entry_date, 'amount_pence', q.bank_pence) ORDER BY q.entry_date DESC, q.posting_id)
          FROM (SELECT * FROM pay WHERE pay.entry_date BETWEEN v_from AND v_to ORDER BY pay.entry_date DESC, pay.posting_id LIMIT 200) q), '[]'::jsonb) END,
      'imports', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', i.id, 'file_name', i.file_name, 'row_count', i.row_count, 'first_date', i.first_date,
            'last_date', i.last_date, 'created_at', i.created_at) ORDER BY i.created_at DESC, i.id)
          FROM (SELECT * FROM public.ledger_bank_imports WHERE bank_account_id = a.id ORDER BY created_at DESC, id LIMIT 20) i), '[]'::jsonb),
      'covered_from', v_from, 'covered_to', v_to,
      'reconciliation', jsonb_build_object('as_at', v_as_at, 'ledger_balance_pence', v_ledger,
        'statement_balance_pence', v_stmt.balance_pence, 'statement_balance_date', v_stmt.line_date,
        'difference_pence', CASE WHEN v_stmt.balance_pence IS NULL THEN NULL ELSE v_stmt.balance_pence - v_ledger END,
        'shared_ledger_account', (SELECT count(*) > 1 FROM public.ledger_bank_accounts x WHERE x.organization_id = p_org AND x.ledger_account_id = a.ledger_account_id)))
  );
END;
$function$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['ledger_bank_account_save(uuid,uuid,text,text,boolean)', 'ledger_bank_import(uuid,uuid,text,jsonb)', 'ledger_bank_match_run(uuid,uuid)',
                           'ledger_bank_match(uuid,uuid,uuid)', 'ledger_bank_unmatch(uuid,uuid)', 'ledger_bank_ignore(uuid,uuid,text)', 'ledger_bank_unignore(uuid,uuid)',
                           'ledger_bank_overview(uuid,uuid,date,integer)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', f);
  END LOOP;
END $$;

-- Final check: no anon access anywhere new, no write grants, every new function with an empty search_path.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ledger_bank_accounts', 'ledger_bank_imports', 'ledger_bank_lines'] LOOP
    IF has_table_privilege('anon', 'public.' || t, 'SELECT') OR has_table_privilege('authenticated', 'public.' || t, 'INSERT')
       OR has_table_privilege('authenticated', 'public.' || t, 'UPDATE') OR has_table_privilege('authenticated', 'public.' || t, 'DELETE')
       OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = ('public.' || t)::regclass) THEN
      RAISE EXCEPTION 'privilege check failed on %', t;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname LIKE '%ledger_bank%'
              AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c = 'search_path=""')))
     OR has_function_privilege('authenticated', 'public._ledger_bank_match_run(uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'function privilege check failed';
  END IF;
END $$;

COMMIT;
