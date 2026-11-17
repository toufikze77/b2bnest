-- =====================================================================================================================
-- Finance phase 3c-2: post unmatched bank statement lines to the ledger. PREPARED, NOT APPLIED.
-- Read docs/ledger-bank-post/README.md first. One transaction.
--
-- A manager posts an unmatched statement line (a bank fee, interest, a transfer, owner money) as ONE balanced two-line
-- journal against ONE counter account they choose; nothing is ever posted automatically. Un-posting reverses that journal
-- (a separate reversal journal, as ledger_reverse_journal does; nothing is deleted or edited) and the line is unmatched again.
--
-- Changes to existing objects (the only ones; no table is added):
--  * journal_entries.je_source_type: + 'bank_line' (every existing value kept).
--  * ledger_bank_lines: lbl_status + 'posted'; new nullable columns posted_entry_id (FK journal_entries, unique),
--    posted_account_id (FK ledger_accounts), posted_by (opaque id), posted_at; lbl_state extended for 'posted'.
--  * CREATE OR REPLACE (same signatures and grants), all phase 3c-1 functions (docs/ledger-bank/proposal.sql):
--    _ledger_bank_guard (+ the posted_* columns may change; a posted line names its own journal),
--    _ledger_bank_match_run (+ a posted line whose journal was reversed goes back to unmatched),
--    ledger_bank_match and ledger_bank_ignore (refuse a posted line), ledger_bank_overview (+ posted lines, post_broken).
-- New: _ledger_bank_allowed_account, _ledger_bank_post_line (internal); ledger_bank_post, ledger_bank_post_many,
--  ledger_bank_unpost (RPCs). Nothing from phases 2, 3a, 3b or 4 is replaced; ledger_reverse_journal is called unchanged.
--
-- Production facts (17 Nov 2026, read read-only by the owner's assistant): 160 tables in public, md5 of the names sorted
-- and joined with ',' = b9fec97b9d0d8c836c6af78125e92371; the constraint definitions below; md5(prosrc) of the functions
-- below as production stores them (a body is accepted raw, without whole-line comments, or without any '--' comment).
-- THE OWNER'S ASSISTANT RE-VERIFIES THESE BEFORE APPLYING; anything else: refused.
-- Rollback: docs/ledger-bank-post/rollback.sql (refuses once any bank-line journal exists). Tests: run-test.sh here.
-- =====================================================================================================================
BEGIN;

DO $$
DECLARE r record; v text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.ledger_bank_lines'::regclass AND attname = 'posted_entry_id' AND NOT attisdropped)
     OR to_regprocedure('public.ledger_bank_post(uuid,uuid,uuid,text)') IS NOT NULL THEN
    RAISE EXCEPTION 'Finance phase 3c-2 bank-line posting already exists (applied twice?)';
  END IF;
  IF (SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind IN ('r', 'p')) <> 160
     OR (SELECT md5(string_agg(relname, ',' ORDER BY relname)) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind IN ('r', 'p'))
        IS DISTINCT FROM 'b9fec97b9d0d8c836c6af78125e92371' THEN
    RAISE EXCEPTION 'the tables in public differ from production as read on 17 Nov 2026 (160 tables)';
  END IF;
  FOR r IN SELECT fn, array_agg(h) AS hs FROM (VALUES
      -- Replaced here (the phase 3c-1 bodies, as applied on 15 Nov 2026):
      ('public._ledger_bank_guard()', '81d91fd52972bbfc89479f1c5beb16af'),
      ('public._ledger_bank_match_run(uuid,uuid)', 'ed3fb594c45a3d9cf42d911e7422f4ea'),
      ('public.ledger_bank_match(uuid,uuid,uuid)', 'a0149562bed66a17bec6d12bdb384a5b'),
      ('public.ledger_bank_ignore(uuid,uuid,text)', 'c5e5f59fed8085bf214f68e8df2da433'),
      ('public.ledger_bank_overview(uuid,uuid,date,integer)', 'b8571c12cddb23ebe25dddb554a336ee'),
      -- Called or relied on, unchanged:
      ('public._ledger_rule(uuid,uuid)', 'edf2117e8b0bdeb3826552b712faa227'),
      ('public._ledger_require_writer(uuid)', '75ecf4a981581daae33e90dc554f01c4'),
      ('public._ledger_org_open(uuid)', '361077573d6cc7f9c83c6702808d61cd'),
      ('public.require_aal2_if_enrolled()', '10b2ae7bd2f9a94ea20598f19b8aebf2'),
      ('public.ledger_reverse_journal(uuid,text,date)', '22157acb97b8b8cb3ade3318177353b9'),
      ('public._ledger_post(uuid,date,text,text,jsonb,text,text,uuid)', '019a0b8e74b6d142e5623b09f7de27d6'),
      ('public._ledger_entry_guard()', '727748e665991e8105a96e15f7f9929c'),
      ('public._ledger_line_guard()', '041398b1d1ecbd5856c7cab85aff8479'),
      ('public._ledger_balance_check()', 'ee84f8fd18cb93fcd9fa1dfbd6aa36e7'),
      ('public._ledger_append_only()', 'f47e341b7cca2f0118e8e70493984e56'),
      ('public._ledger_bank_audit(text,text,uuid,jsonb)', '3d0ebe1c83575ea519e5bd49e0171491'),
      ('public._ledger_bank_open_payments(uuid,uuid)', '48024e023dad4ba04b776097a14f8c21'),
      ('public._ledger_bank_posting_pence(uuid,uuid)', '2a4e1151b3decd06b605ebb6c644ebb6'),
      ('public.ledger_bank_match_run(uuid,uuid)', '33a0fcbc484c990936a15bf1331b996f'),
      ('public.ledger_bank_unmatch(uuid,uuid)', '475f35dce82bcde42cefca63ed61b0b1'),
      ('public.ledger_bank_unignore(uuid,uuid)', '71d86e85e5f07f1d139b97fdbe7974d4'),
      ('public.ledger_report_completeness(uuid)', '6d8cf9d49296fec90687f3ad0fb95acf'),
      ('public.demo_readonly_guard()', '087b5fe2695b95b8ba2ba6eb195ba995'),
      ('public._data_rights_gate_is_open(text)', 'b22b22eda6bd86e8ff363a6a58bfe3a3'),
      ('public._data_rights_closed_company_guard()', '2ec2d8630e284aed65d010c61a442a53')) x(fn, h) GROUP BY fn LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc p, LATERAL (SELECT regexp_replace(p.prosrc, E'\\n[ \\t]*--[^\\n]*', '', 'g') AS lines) c
                    WHERE p.oid = to_regprocedure(r.fn)
                      AND (md5(p.prosrc) = ANY (r.hs) OR md5(c.lines) = ANY (r.hs) OR md5(regexp_replace(c.lines, E'[ \\t]*--[^\\n]*', '', 'g')) = ANY (r.hs))) THEN
      RAISE EXCEPTION '% differs from the body this was written against (or is missing)', r.fn;
    END IF;
  END LOOP;
  FOR r IN SELECT * FROM (VALUES
      ('public.journal_entries', 'je_source_type', 'CHECK ((source_type = ANY (ARRAY[''manual''::text, ''opening_balance''::text, ''reversal''::text, ''auto_invoice''::text, ''auto_invoice_payment''::text, ''auto_bill''::text, ''auto_bill_payment''::text, ''auto_expense''::text])))'),
      ('public.journal_entries', 'je_reversal', 'CHECK (((source_type = ''reversal''::text) = (reverses_entry_id IS NOT NULL)))'),
      ('public.ledger_bank_lines', 'lbl_status', 'CHECK ((status = ANY (ARRAY[''unmatched''::text, ''matched''::text, ''ignored''::text])))'),
      ('public.ledger_bank_lines', 'lbl_state', 'CHECK ((((status = ''unmatched''::text) AND (matched_posting_id IS NULL) AND (match_kind IS NULL) AND (matched_by IS NULL) AND (matched_at IS NULL) AND (ignore_reason IS NULL)) OR ((status = ''matched''::text) AND (matched_posting_id IS NOT NULL) AND (match_kind IS NOT NULL) AND (matched_at IS NOT NULL) AND (ignore_reason IS NULL)) OR ((status = ''ignored''::text) AND (ignore_reason IS NOT NULL) AND (matched_posting_id IS NULL) AND (match_kind IS NULL) AND (matched_by IS NULL) AND (matched_at IS NULL))))')) c(t, n, d) LOOP
    SELECT pg_get_constraintdef(oid) INTO v FROM pg_constraint WHERE conrelid = r.t::regclass AND conname = r.n;
    IF v IS DISTINCT FROM r.d THEN RAISE EXCEPTION '%.% differs from what this was written against (%)', r.t, r.n, v; END IF;
  END LOOP;
  IF (SELECT string_agg(attname || ':' || format_type(atttypid, atttypmod), ',' ORDER BY attname) FROM pg_attribute
       WHERE attrelid = 'public.journal_entries'::regclass AND attname IN ('source_id', 'source_type', 'reason', 'posted_by', 'posted_by_name', 'idempotency_key') AND NOT attisdropped)
     IS DISTINCT FROM 'idempotency_key:text,posted_by:uuid,posted_by_name:text,reason:text,source_id:uuid,source_type:text' THEN
    RAISE EXCEPTION 'journal_entries columns differ from what this was written against';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. Constraints and columns. Existing lines are all unmatched, matched or ignored, so the new columns start NULL and the
--    extended checks hold for every existing row.
-- ---------------------------------------------------------------------------------------------------------------------
ALTER TABLE public.journal_entries DROP CONSTRAINT je_source_type;
ALTER TABLE public.journal_entries ADD CONSTRAINT je_source_type CHECK (source_type IN ('manual', 'opening_balance', 'reversal', 'auto_invoice', 'auto_invoice_payment',
  'auto_bill', 'auto_bill_payment', 'auto_expense', 'bank_line'));

ALTER TABLE public.ledger_bank_lines DROP CONSTRAINT lbl_state, DROP CONSTRAINT lbl_status;
ALTER TABLE public.ledger_bank_lines
  ADD COLUMN posted_entry_id uuid CONSTRAINT lbl_posted_entry UNIQUE CONSTRAINT lbl_posted_entry_fk REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  ADD COLUMN posted_account_id uuid CONSTRAINT lbl_posted_account REFERENCES public.ledger_accounts(id) ON DELETE CASCADE,
  ADD COLUMN posted_by uuid,
  ADD COLUMN posted_at timestamptz;
ALTER TABLE public.ledger_bank_lines
  ADD CONSTRAINT lbl_status CHECK (status IN ('unmatched', 'matched', 'ignored', 'posted')),
  ADD CONSTRAINT lbl_state CHECK (
       (status = 'unmatched' AND matched_posting_id IS NULL AND match_kind IS NULL AND matched_by IS NULL AND matched_at IS NULL AND ignore_reason IS NULL
         AND posted_entry_id IS NULL AND posted_account_id IS NULL AND posted_by IS NULL AND posted_at IS NULL)
    OR (status = 'matched' AND matched_posting_id IS NOT NULL AND match_kind IS NOT NULL AND matched_at IS NOT NULL AND ignore_reason IS NULL
         AND posted_entry_id IS NULL AND posted_account_id IS NULL AND posted_by IS NULL AND posted_at IS NULL)
    OR (status = 'ignored' AND ignore_reason IS NOT NULL AND matched_posting_id IS NULL AND match_kind IS NULL AND matched_by IS NULL AND matched_at IS NULL
         AND posted_entry_id IS NULL AND posted_account_id IS NULL AND posted_by IS NULL AND posted_at IS NULL)
    OR (status = 'posted' AND posted_entry_id IS NOT NULL AND posted_account_id IS NOT NULL AND posted_at IS NOT NULL
         AND matched_posting_id IS NULL AND match_kind IS NULL AND matched_by IS NULL AND matched_at IS NULL AND ignore_reason IS NULL));
COMMENT ON COLUMN public.ledger_bank_lines.posted_entry_id IS 'Finance phase 3c-2: the bank-line journal this line was posted with (source_type bank_line, source_id = this line). posted_by is an opaque id.';

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. The phase 3c-1 functions, replaced (same signatures; grants are kept by CREATE OR REPLACE and re-checked below).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._ledger_bank_guard()
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
  IF TG_OP = 'UPDATE' AND (to_jsonb(NEW) - ARRAY['status', 'matched_posting_id', 'match_kind', 'matched_by', 'matched_at', 'ignore_reason', 'posted_entry_id', 'posted_account_id', 'posted_by', 'posted_at'])
                          IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status', 'matched_posting_id', 'match_kind', 'matched_by', 'matched_at', 'ignore_reason', 'posted_entry_id', 'posted_account_id', 'posted_by', 'posted_at']) THEN
    RAISE EXCEPTION 'LEDGER_APPEND_ONLY: an imported line''s date, amount and description never change' USING ERRCODE = '42501';
  END IF;
  IF NEW.matched_posting_id IS NOT NULL AND NEW.matched_posting_id IS DISTINCT FROM (CASE WHEN TG_OP = 'UPDATE' THEN OLD.matched_posting_id END) THEN
    SELECT p.kind, p.organization_id INTO v_kind, v_org FROM public.ledger_postings p WHERE p.id = NEW.matched_posting_id;
    IF v_org IS DISTINCT FROM NEW.organization_id OR v_kind NOT IN ('invoice_paid', 'bill_paid', 'expense') THEN
      RAISE EXCEPTION 'LEDGER_BANK_NOT_A_PAYMENT' USING ERRCODE = '22023';
    END IF;
  END IF;
  -- Finance phase 3c-2: a posted line names its own bank-line journal and an account of the same company.
  IF NEW.posted_entry_id IS NOT NULL AND NEW.posted_entry_id IS DISTINCT FROM (CASE WHEN TG_OP = 'UPDATE' THEN OLD.posted_entry_id END) THEN
    IF NOT EXISTS (SELECT 1 FROM public.journal_entries e WHERE e.id = NEW.posted_entry_id AND e.organization_id = NEW.organization_id
                    AND e.source_type = 'bank_line' AND e.source_id = NEW.id) THEN
      RAISE EXCEPTION 'LEDGER_BANK_NOT_ITS_JOURNAL' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.ledger_accounts x WHERE x.id = NEW.posted_account_id AND x.organization_id = NEW.organization_id) THEN
      RAISE EXCEPTION 'LEDGER_BANK_ACCOUNT_NOT_ALLOWED' USING ERRCODE = '22023';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public._ledger_bank_match_run(p_org uuid, p_bank_account uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_acc public.ledger_bank_accounts; r record; v_unlinked integer := 0; v_matched integer := 0; v_unposted integer := 0;
BEGIN
  SELECT * INTO v_acc FROM public.ledger_bank_accounts a WHERE a.id = p_bank_account AND a.organization_id = p_org;
  IF NOT FOUND THEN RAISE EXCEPTION 'LEDGER_NOT_FOUND' USING ERRCODE = '22023'; END IF;
  -- Finance phase 3c-2: a posted line whose journal was reversed from the Journals screen goes back to unmatched.
  FOR r IN SELECT b.id, b.posted_entry_id, b.posted_account_id FROM public.ledger_bank_lines b
            WHERE b.organization_id = p_org AND b.bank_account_id = p_bank_account AND b.status = 'posted'
              AND EXISTS (SELECT 1 FROM public.journal_entries x WHERE x.reverses_entry_id = b.posted_entry_id)
            ORDER BY b.line_date, b.id LOOP
    UPDATE public.ledger_bank_lines SET status = 'unmatched', posted_entry_id = NULL, posted_account_id = NULL, posted_by = NULL, posted_at = NULL WHERE id = r.id;
    PERFORM public._ledger_bank_audit('ledger.bank_unpost', 'bank_statement_line', r.id,
      jsonb_build_object('organization_id', p_org, 'bank_account_id', p_bank_account, 'line_id', r.id, 'entry_id', r.posted_entry_id, 'reason', 'journal_reversed'));
    v_unposted := v_unposted + 1;
  END LOOP;
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
  RETURN jsonb_build_object('matched', v_matched, 'unlinked', v_unlinked, 'unposted', v_unposted);
END;
$function$;

CREATE OR REPLACE FUNCTION public.ledger_bank_match(p_org uuid, p_line uuid, p_posting uuid)
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
  IF l.status = 'posted' THEN RAISE EXCEPTION 'LEDGER_BANK_ALREADY_POSTED' USING ERRCODE = '22023'; END IF;
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

CREATE OR REPLACE FUNCTION public.ledger_bank_ignore(p_org uuid, p_line uuid, p_reason text)
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
  IF l.status = 'posted' THEN RAISE EXCEPTION 'LEDGER_BANK_ALREADY_POSTED' USING ERRCODE = '22023'; END IF;
  IF l.status = 'matched' THEN RAISE EXCEPTION 'LEDGER_BANK_ALREADY_MATCHED' USING ERRCODE = '22023'; END IF;
  IF l.status = 'ignored' AND l.ignore_reason = p_reason THEN RETURN jsonb_build_object('result', 'unchanged', 'line_id', l.id); END IF;
  UPDATE public.ledger_bank_lines SET status = 'ignored', ignore_reason = p_reason WHERE id = l.id;
  PERFORM public._ledger_bank_audit('ledger.bank_ignore', 'ledger_bank_lines', l.id,
    jsonb_build_object('organization_id', p_org, 'bank_account_id', l.bank_account_id, 'reason', p_reason));
  RETURN jsonb_build_object('result', 'ignored', 'line_id', l.id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.ledger_bank_overview(p_org uuid, p_bank_account uuid DEFAULT NULL, p_as_at date DEFAULT NULL, p_page integer DEFAULT 0)
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
         lines AS (SELECT b.*, p.reversed_at AS posting_reversed_at, p.kind AS posting_kind, p.source_label AS posting_label, e.entry_date AS posting_date,
                          pa.code AS posted_code, pa.name AS posted_account_name,
                          (b.posted_entry_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.journal_entries x WHERE x.reverses_entry_id = b.posted_entry_id)) AS post_reversed
                     FROM public.ledger_bank_lines b
                     LEFT JOIN public.ledger_postings p ON p.id = b.matched_posting_id
                     LEFT JOIN public.journal_entries e ON e.id = p.entry_id
                     LEFT JOIN public.ledger_accounts pa ON pa.id = b.posted_account_id
                    WHERE b.bank_account_id = a.id)
    SELECT jsonb_build_object(
      'bank_account_id', a.id,
      'counts', jsonb_build_object(
        'unmatched', (SELECT count(*) FROM lines WHERE status = 'unmatched'),
        'matched', (SELECT count(*) FROM lines WHERE status = 'matched' AND posting_reversed_at IS NULL),
        'ignored', (SELECT count(*) FROM lines WHERE status = 'ignored'),
        'posted', (SELECT count(*) FROM lines WHERE status = 'posted' AND NOT post_reversed),
        'needs_attention', (SELECT count(*) FROM lines WHERE (status = 'matched' AND posting_reversed_at IS NOT NULL) OR (status = 'posted' AND post_reversed))),
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
      'posted', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', t.id, 'line_date', t.line_date, 'description', t.description, 'amount_pence', t.amount_pence,
            'account_id', t.posted_account_id, 'account_code', t.posted_code, 'account_name', t.posted_account_name, 'entry_id', t.posted_entry_id, 'posted_at', t.posted_at)
            ORDER BY t.line_date DESC, t.row_no)
          FROM (SELECT * FROM lines WHERE status = 'posted' AND NOT post_reversed ORDER BY line_date DESC, row_no, id LIMIT 200) t), '[]'::jsonb),
      'needs_attention', COALESCE((SELECT jsonb_agg(n.item ORDER BY n.line_date DESC, n.row_no)
          FROM (SELECT y.* FROM (
                  SELECT x.line_date, x.row_no, jsonb_build_object('id', x.id, 'line_date', x.line_date, 'description', x.description, 'amount_pence', x.amount_pence,
                    'reason', 'match_broken', 'posting_id', x.matched_posting_id, 'kind', x.posting_kind, 'source_label', x.posting_label, 'entry_date', x.posting_date) AS item
                    FROM lines x WHERE x.status = 'matched' AND x.posting_reversed_at IS NOT NULL
                  UNION ALL
                  SELECT x.line_date, x.row_no, jsonb_build_object('id', x.id, 'line_date', x.line_date, 'description', x.description, 'amount_pence', x.amount_pence,
                    'reason', 'post_broken', 'entry_id', x.posted_entry_id, 'account_code', x.posted_code, 'account_name', x.posted_account_name) AS item
                    FROM lines x WHERE x.status = 'posted' AND x.post_reversed) y
                ORDER BY y.line_date DESC, y.row_no LIMIT 200) n), '[]'::jsonb),
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

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. Posting. Internal helpers first (no grants).
-- ---------------------------------------------------------------------------------------------------------------------
-- A counter account a bank line may be posted to: the company's own, active, not the bank account itself, and none of the
-- accounts that invoices, bills, payroll and returns drive (debtors, creditors, VAT control, PAYE and NI, Corporation Tax).
CREATE FUNCTION public._ledger_bank_allowed_account(p_org uuid, p_bank_ledger_account uuid, p_account uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.ledger_accounts a WHERE a.id = p_account AND a.organization_id = p_org AND a.is_active AND a.id <> p_bank_ledger_account
                   AND COALESCE(a.system_key, '') NOT IN ('bank', 'debtors', 'creditors', 'vat_control', 'paye_ni', 'corporation_tax'));
$function$;

-- Posts one line (the caller has checked the person and holds the company lock). Money out: Dr counter account, Cr Bank;
-- money in: Dr Bank, Cr counter account; dated the line's date. The journal is written the way _ledger_auto_journal writes
-- an automatic one (it names its source: source_id = the line), with the poster's name as _ledger_post records it. The
-- ledger's own triggers apply unchanged: start date, period lock, one company, active accounts, balanced at commit.
CREATE FUNCTION public._ledger_bank_post_line(p_org uuid, p_line uuid, p_account uuid, p_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE l public.ledger_bank_lines; ba public.ledger_bank_accounts; x public.ledger_accounts; v_entry uuid; v_name text; v_amt numeric(14,2);
BEGIN
  SELECT * INTO l FROM public.ledger_bank_lines b WHERE b.id = p_line AND b.organization_id = p_org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'LEDGER_NOT_FOUND' USING ERRCODE = '22023'; END IF;
  IF l.status = 'posted' THEN
    IF l.posted_account_id = p_account THEN RETURN jsonb_build_object('result', 'unchanged', 'line_id', l.id, 'entry_id', l.posted_entry_id); END IF;
    RAISE EXCEPTION 'LEDGER_BANK_ALREADY_POSTED' USING ERRCODE = '22023';
  END IF;
  IF l.status = 'matched' THEN RAISE EXCEPTION 'LEDGER_BANK_ALREADY_MATCHED' USING ERRCODE = '22023'; END IF;
  IF l.status = 'ignored' THEN RAISE EXCEPTION 'LEDGER_BANK_IGNORED' USING ERRCODE = '22023'; END IF;
  SELECT * INTO ba FROM public.ledger_bank_accounts a WHERE a.id = l.bank_account_id;
  IF NOT public._ledger_bank_allowed_account(p_org, ba.ledger_account_id, p_account) THEN RAISE EXCEPTION 'LEDGER_BANK_ACCOUNT_NOT_ALLOWED' USING ERRCODE = '22023'; END IF;
  SELECT * INTO x FROM public.ledger_accounts a WHERE a.id = p_account;
  IF p_key IS NOT NULL THEN
    IF p_key !~ '^[A-Za-z0-9_-]{8,80}$' THEN RAISE EXCEPTION 'LEDGER_BAD_KEY' USING ERRCODE = '22023'; END IF;
    IF EXISTS (SELECT 1 FROM public.journal_entries e WHERE e.organization_id = p_org AND e.idempotency_key = p_key) THEN
      RAISE EXCEPTION 'LEDGER_BANK_KEY_USED' USING ERRCODE = '22023';
    END IF;
  END IF;
  v_amt := (abs(l.amount_pence) / 100.0)::numeric(14,2);
  SELECT COALESCE(NULLIF(btrim(p.display_name), ''), NULLIF(btrim(p.full_name), '')) INTO v_name FROM public.profiles p WHERE p.id = auth.uid();
  INSERT INTO public.journal_entries (organization_id, entry_date, memo, reason, source_type, source_id, idempotency_key, posted_by, posted_by_name)
  VALUES (p_org, l.line_date, left('Bank: ' || l.description, 200), 'Bank statement line', 'bank_line', l.id, p_key, auth.uid(), left(v_name, 120))
  RETURNING id INTO v_entry;
  PERFORM set_config('ledger.posting_entry', v_entry::text, true);
  INSERT INTO public.journal_lines (entry_id, organization_id, account_id, line_no, debit, credit)
  VALUES (v_entry, p_org, CASE WHEN l.amount_pence < 0 THEN x.id ELSE ba.ledger_account_id END, 1, v_amt, 0),
         (v_entry, p_org, CASE WHEN l.amount_pence < 0 THEN ba.ledger_account_id ELSE x.id END, 2, 0, v_amt);
  PERFORM set_config('ledger.posting_entry', '', true);
  SET CONSTRAINTS public.ledger_balanced IMMEDIATE;
  SET CONSTRAINTS public.ledger_balanced DEFERRED;
  UPDATE public.ledger_bank_lines SET status = 'posted', posted_entry_id = v_entry, posted_account_id = x.id, posted_by = (SELECT auth.uid()), posted_at = now() WHERE id = l.id;
  PERFORM public._ledger_bank_audit('ledger.bank_post', 'bank_statement_line', l.id,
    jsonb_build_object('organization_id', p_org, 'bank_account_id', l.bank_account_id, 'line_id', l.id, 'amount_pence', l.amount_pence, 'account_code', x.code, 'entry_id', v_entry));
  RETURN jsonb_build_object('result', 'posted', 'line_id', l.id, 'entry_id', v_entry);
END;
$function$;
REVOKE ALL ON FUNCTION public._ledger_bank_allowed_account(uuid, uuid, uuid), public._ledger_bank_post_line(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated, service_role;

-- One line. Again with the same account: unchanged; with another account: refused (un-post first).
CREATE FUNCTION public.ledger_bank_post(p_org uuid, p_line uuid, p_account uuid, p_idempotency_key text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  PERFORM public._ledger_require_writer(p_org);
  PERFORM pg_advisory_xact_lock(hashtextextended('ledger:' || p_org::text, 0));
  RETURN public._ledger_bank_post_line(p_org, p_line, p_account, p_idempotency_key);
END;
$function$;

-- Up to 50 lines to one account, all or nothing (any refusal undoes the whole call).
CREATE FUNCTION public.ledger_bank_post_many(p_org uuid, p_account uuid, p_lines uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_id uuid; r jsonb; v_posted integer := 0; v_unchanged integer := 0; v_entries jsonb := '[]'::jsonb;
BEGIN
  PERFORM public._ledger_require_writer(p_org);
  IF p_lines IS NULL OR cardinality(p_lines) = 0 OR array_position(p_lines, NULL) IS NOT NULL
     OR cardinality(p_lines) <> (SELECT count(DISTINCT u) FROM unnest(p_lines) u) THEN
    RAISE EXCEPTION 'LEDGER_BAD_REQUEST' USING ERRCODE = '22023';
  END IF;
  IF cardinality(p_lines) > 50 THEN RAISE EXCEPTION 'LEDGER_BANK_TOO_MANY_LINES' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('ledger:' || p_org::text, 0));
  FOREACH v_id IN ARRAY p_lines LOOP
    r := public._ledger_bank_post_line(p_org, v_id, p_account, NULL);
    IF r ->> 'result' = 'posted' THEN v_posted := v_posted + 1; ELSE v_unchanged := v_unchanged + 1; END IF;
    v_entries := v_entries || jsonb_build_array(r -> 'entry_id');
  END LOOP;
  RETURN jsonb_build_object('result', 'ok', 'posted', v_posted, 'unchanged', v_unchanged, 'entry_ids', v_entries);
END;
$function$;

-- Un-post: reverse the line's journal with ledger_reverse_journal (a separate reversal journal dated the line's date, or
-- today when that date is before the ledger start or in a locked period), then the line is unmatched again. If the
-- journal was already reversed from the Journals screen it is not reversed twice.
CREATE FUNCTION public.ledger_bank_unpost(p_org uuid, p_line uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE l public.ledger_bank_lines; s public.ledger_settings; v_rev uuid; v_date date; v_dated text; v_how text;
BEGIN
  PERFORM public._ledger_require_writer(p_org);
  PERFORM pg_advisory_xact_lock(hashtextextended('ledger:' || p_org::text, 0));
  SELECT * INTO l FROM public.ledger_bank_lines b WHERE b.id = p_line AND b.organization_id = p_org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'LEDGER_NOT_FOUND' USING ERRCODE = '22023'; END IF;
  IF l.status <> 'posted' THEN RAISE EXCEPTION 'LEDGER_BANK_NOT_POSTED' USING ERRCODE = '22023'; END IF;
  SELECT e.id INTO v_rev FROM public.journal_entries e WHERE e.reverses_entry_id = l.posted_entry_id;
  IF v_rev IS NOT NULL THEN
    v_how := 'already_reversed';
  ELSE
    SELECT * INTO s FROM public.ledger_settings WHERE organization_id = p_org;
    IF l.line_date < s.start_date OR (s.locked_through IS NOT NULL AND l.line_date <= s.locked_through) THEN v_date := current_date; v_dated := 'today';
    ELSE v_date := l.line_date; v_dated := 'line_date'; END IF;
    v_rev := (public.ledger_reverse_journal(l.posted_entry_id, 'Bank statement line un-posted', v_date) ->> 'entry_id')::uuid;
    v_how := 'reversed';
  END IF;
  UPDATE public.ledger_bank_lines SET status = 'unmatched', posted_entry_id = NULL, posted_account_id = NULL, posted_by = NULL, posted_at = NULL WHERE id = l.id;
  PERFORM public._ledger_bank_audit('ledger.bank_unpost', 'bank_statement_line', l.id,
    jsonb_build_object('organization_id', p_org, 'bank_account_id', l.bank_account_id, 'line_id', l.id, 'entry_id', l.posted_entry_id,
                       'reversal_entry_id', v_rev, 'reason', v_how, 'reversal_dated', v_dated));
  RETURN jsonb_build_object('result', 'unposted', 'line_id', l.id, 'how', v_how, 'reversal_entry_id', v_rev, 'reversal_date', v_date, 'reversal_dated', v_dated);
END;
$function$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['ledger_bank_post(uuid,uuid,uuid,text)', 'ledger_bank_post_many(uuid,uuid,uuid[])', 'ledger_bank_unpost(uuid,uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', f);
  END LOOP;
END $$;

-- Final check: the replaced functions kept their grants; nothing new is open to anon; every bank function has an empty search_path.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname LIKE '%ledger_bank%'
              AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c = 'search_path=""')))
     OR NOT has_function_privilege('authenticated', 'public.ledger_bank_overview(uuid,uuid,date,integer)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.ledger_bank_match(uuid,uuid,uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.ledger_bank_ignore(uuid,uuid,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public._ledger_bank_match_run(uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public._ledger_bank_guard()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public._ledger_bank_post_line(uuid,uuid,uuid,text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.ledger_bank_post(uuid,uuid,uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'function privilege check failed';
  END IF;
END $$;

COMMIT;
