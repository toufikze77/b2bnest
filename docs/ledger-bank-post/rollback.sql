-- =====================================================================================================================
-- Finance phase 3c-2 rollback (docs/ledger-bank-post/proposal.sql). Puts phase 3c-1 back exactly: the constraints, the
-- five replaced functions (their 3c-1 bodies), and drops the new columns and functions.
-- Refuses while any line is posted, and once any bank-line journal exists (even un-posted ones: journals are never
-- deleted, so the 'bank_line' journal type must then stay). In that case leave 3c-2 in place.
-- =====================================================================================================================
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.ledger_bank_lines'::regclass AND attname = 'posted_entry_id' AND NOT attisdropped) THEN
    RAISE EXCEPTION 'Finance phase 3c-2 is not applied';
  END IF;
  IF EXISTS (SELECT 1 FROM public.ledger_bank_lines WHERE status = 'posted') THEN
    RAISE EXCEPTION 'ledger_bank_lines holds posted lines (% of them): un-post them first (Ledger, Bank, Posted, Undo), or leave 3c-2 in place.',
      (SELECT count(*) FROM public.ledger_bank_lines WHERE status = 'posted');
  END IF;
  IF EXISTS (SELECT 1 FROM public.journal_entries WHERE source_type = 'bank_line') THEN
    RAISE EXCEPTION 'journal_entries holds % bank-line journals (posted and later reversed). Journals are never deleted, so the bank_line journal type must stay: leave 3c-2 in place.',
      (SELECT count(*) FROM public.journal_entries WHERE source_type = 'bank_line');
  END IF;
END $$;
DROP FUNCTION public.ledger_bank_unpost(uuid, uuid);
DROP FUNCTION public.ledger_bank_post_many(uuid, uuid, uuid[]);
DROP FUNCTION public.ledger_bank_post(uuid, uuid, uuid, text);
DROP FUNCTION public._ledger_bank_post_line(uuid, uuid, uuid, text);
DROP FUNCTION public._ledger_bank_allowed_account(uuid, uuid, uuid);

-- The phase 3c-1 bodies, exactly as docs/ledger-bank/proposal.sql created them (grants are kept by CREATE OR REPLACE).
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

CREATE OR REPLACE FUNCTION public._ledger_bank_match_run(p_org uuid, p_bank_account uuid)
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

ALTER TABLE public.ledger_bank_lines DROP CONSTRAINT lbl_state, DROP CONSTRAINT lbl_status;
ALTER TABLE public.ledger_bank_lines DROP COLUMN posted_entry_id, DROP COLUMN posted_account_id, DROP COLUMN posted_by, DROP COLUMN posted_at;
ALTER TABLE public.ledger_bank_lines
  ADD CONSTRAINT lbl_status CHECK (status IN ('unmatched', 'matched', 'ignored')),
  ADD CONSTRAINT lbl_state CHECK (
       (status = 'unmatched' AND matched_posting_id IS NULL AND match_kind IS NULL AND matched_by IS NULL AND matched_at IS NULL AND ignore_reason IS NULL)
    OR (status = 'matched' AND matched_posting_id IS NOT NULL AND match_kind IS NOT NULL AND matched_at IS NOT NULL AND ignore_reason IS NULL)
    OR (status = 'ignored' AND ignore_reason IS NOT NULL AND matched_posting_id IS NULL AND match_kind IS NULL AND matched_by IS NULL AND matched_at IS NULL));
ALTER TABLE public.journal_entries DROP CONSTRAINT je_source_type;
ALTER TABLE public.journal_entries ADD CONSTRAINT je_source_type CHECK (source_type IN ('manual', 'opening_balance', 'reversal', 'auto_invoice', 'auto_invoice_payment',
  'auto_bill', 'auto_bill_payment', 'auto_expense'));
COMMIT;
