-- =====================================================================================================================
-- Finance phase 4: reports from the ledger (profit and loss, balance sheet, account detail). PREPARED, NOT APPLIED.
-- Read docs/ledger-reports/README.md first. One transaction.
--
-- Read only: four new functions, nothing else. No table, column, trigger, policy, grant or existing function changes;
-- nothing is posted, filed or sent anywhere. Every figure comes from the ledger only (journal_entries, journal_lines,
-- ledger_accounts; ledger_postings for the source label). The completeness check also counts the automatic-postings
-- queue and issues and the unmatched bank statement lines (read only).
--
-- New: ledger_report_profit_loss(uuid,date,date), ledger_report_balance_sheet(uuid,date),
--      ledger_report_account_detail(uuid,uuid,date,date), ledger_report_completeness(uuid).
--
-- Production facts (16 Nov 2026, read read-only by the owner's assistant): 160 tables in public, md5 of the names
-- sorted and joined with ',' = b9fec97b9d0d8c836c6af78125e92371 (the method of docs/ledger-bank/proposal.sql:
--   SELECT md5(string_agg(relname, ',' ORDER BY relname)) FROM pg_class WHERE relnamespace = 'public'::regnamespace
--     AND relkind IN ('r', 'p')), the column types below, and md5(prosrc) of the functions below as production
-- stores them (a body is accepted raw, without whole-line comments, or without any '--' comment).
-- THE OWNER'S ASSISTANT RE-VERIFIES THESE BEFORE APPLYING; anything else: refused.
-- Rollback: docs/ledger-reports/rollback.sql (drops the four functions). Tests: docs/ledger-reports/run-test.sh.
-- =====================================================================================================================
BEGIN;

DO $$
DECLARE r record; v text;
BEGIN
  IF to_regprocedure('public.ledger_report_profit_loss(uuid,date,date)') IS NOT NULL OR to_regprocedure('public.ledger_report_balance_sheet(uuid,date)') IS NOT NULL
     OR to_regprocedure('public.ledger_report_account_detail(uuid,uuid,date,date)') IS NOT NULL OR to_regprocedure('public.ledger_report_completeness(uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'Finance phase 4 ledger reports already exist (applied twice?)';
  END IF;
  IF (SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind IN ('r', 'p')) <> 160
     OR (SELECT md5(string_agg(relname, ',' ORDER BY relname)) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind IN ('r', 'p'))
        IS DISTINCT FROM 'b9fec97b9d0d8c836c6af78125e92371' THEN
    RAISE EXCEPTION 'the tables in public differ from production as read on 16 Nov 2026 (160 tables)';
  END IF;
  FOR r IN SELECT fn, array_agg(h) AS hs FROM (VALUES
      ('public._ledger_rule(uuid,uuid)', 'edf2117e8b0bdeb3826552b712faa227'),
      ('public._ledger_org_open(uuid)', '361077573d6cc7f9c83c6702808d61cd'),
      ('public.require_aal2_if_enrolled()', '10b2ae7bd2f9a94ea20598f19b8aebf2'),
      ('public.ledger_trial_balance(uuid,date)', '5a165b9517c73e03556e9e5aab72c95e'),
      ('public.mfa_ok()', '20516f2ec203220b3ac08d1230c7c306'), ('public.mfa_ok()', 'c6fd9b98a36055f056bbd682cb57f3aa'),
      ('public.hmrc_manage_allowed(uuid,uuid)', '9304f069f05402aab62d343b3626cd65'), ('public.hmrc_manage_allowed(uuid,uuid)', '801908512427b85279c33bfffd64922e'))
      x(fn, h) GROUP BY fn LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc p, LATERAL (SELECT regexp_replace(p.prosrc, E'\\n[ \\t]*--[^\\n]*', '', 'g') AS lines) c
                    WHERE p.oid = to_regprocedure(r.fn)
                      AND (md5(p.prosrc) = ANY (r.hs) OR md5(c.lines) = ANY (r.hs) OR md5(regexp_replace(c.lines, E'[ \\t]*--[^\\n]*', '', 'g')) = ANY (r.hs))) THEN
      RAISE EXCEPTION '% differs from the body this was written against (or is missing)', r.fn;
    END IF;
  END LOOP;
  -- The columns this reads, with their types.
  SELECT string_agg(c.relname || '.' || a.attname || ':' || format_type(a.atttypid, a.atttypmod), ',' ORDER BY c.relname, a.attname) INTO v
    FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
   WHERE c.relnamespace = 'public'::regnamespace AND NOT a.attisdropped AND a.attnum > 0
     AND ((c.relname = 'ledger_accounts' AND a.attname IN ('id', 'organization_id', 'code', 'name', 'type', 'normal_side', 'is_active', 'system_key'))
       OR (c.relname = 'journal_entries' AND a.attname IN ('id', 'organization_id', 'entry_date', 'source_type', 'reverses_entry_id', 'memo', 'posted_at'))
       OR (c.relname = 'journal_lines' AND a.attname IN ('entry_id', 'account_id', 'line_no', 'debit', 'credit', 'description'))
       OR (c.relname = 'ledger_postings' AND a.attname IN ('entry_id', 'reversal_entry_id', 'kind', 'source_label'))
       OR (c.relname = 'ledger_settings' AND a.attname IN ('organization_id', 'start_date', 'locked_through'))
       OR (c.relname = 'ledger_auto_settings' AND a.attname IN ('organization_id', 'invoices_enabled', 'bills_enabled'))
       OR (c.relname = 'ledger_post_queue' AND a.attname IN ('organization_id', 'source_id'))
       OR (c.relname = 'ledger_post_issues' AND a.attname IN ('organization_id', 'resolved_at'))
       OR (c.relname = 'ledger_bank_lines' AND a.attname IN ('organization_id', 'status')));
  IF v IS DISTINCT FROM 'journal_entries.entry_date:date,journal_entries.id:uuid,journal_entries.memo:text,journal_entries.organization_id:uuid,'
     || 'journal_entries.posted_at:timestamp with time zone,journal_entries.reverses_entry_id:uuid,journal_entries.source_type:text,'
     || 'journal_lines.account_id:uuid,journal_lines.credit:numeric(14,2),journal_lines.debit:numeric(14,2),journal_lines.description:text,journal_lines.entry_id:uuid,'
     || 'journal_lines.line_no:integer,ledger_accounts.code:text,ledger_accounts.id:uuid,ledger_accounts.is_active:boolean,ledger_accounts.name:text,'
     || 'ledger_accounts.normal_side:text,ledger_accounts.organization_id:uuid,ledger_accounts.system_key:text,ledger_accounts.type:text,'
     || 'ledger_auto_settings.bills_enabled:boolean,ledger_auto_settings.invoices_enabled:boolean,ledger_auto_settings.organization_id:uuid,'
     || 'ledger_bank_lines.organization_id:uuid,ledger_bank_lines.status:text,ledger_post_issues.organization_id:uuid,'
     || 'ledger_post_issues.resolved_at:timestamp with time zone,ledger_post_queue.organization_id:uuid,ledger_post_queue.source_id:uuid,'
     || 'ledger_postings.entry_id:uuid,ledger_postings.kind:text,ledger_postings.reversal_entry_id:uuid,ledger_postings.source_label:text,'
     || 'ledger_settings.locked_through:date,ledger_settings.organization_id:uuid,ledger_settings.start_date:date' THEN
    RAISE EXCEPTION 'the ledger columns differ from what this was written against (%)', v;
  END IF;
  SELECT pg_get_constraintdef(oid) INTO v FROM pg_constraint WHERE conrelid = 'public.ledger_accounts'::regclass AND conname = 'la_type';
  IF v IS DISTINCT FROM 'CHECK ((type = ANY (ARRAY[''asset''::text, ''liability''::text, ''equity''::text, ''income''::text, ''expense''::text])))' THEN
    RAISE EXCEPTION 'ledger_accounts.la_type differs from phase 2 (%)', v;
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. Profit and loss for a date range (entry_date, both ends included). Income and expense accounts with any line in
--    the range. amount: income = credits - debits; expense = debits - credits (so each is positive in the usual case).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.ledger_report_profit_loss(p_org uuid, p_from date, p_to date)
 RETURNS TABLE(account_id uuid, code text, name text, type text, is_active boolean, amount numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_rule text;
BEGIN
  PERFORM public.require_aal2_if_enrolled();
  v_rule := public._ledger_rule(p_org, auth.uid());
  IF v_rule NOT IN ('ok', 'not_admin') THEN RAISE EXCEPTION 'LEDGER_%', upper(v_rule) USING ERRCODE = '42501'; END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to OR p_to >= (p_from + interval '5 years')::date THEN
    RAISE EXCEPTION 'LEDGER_BAD_RANGE' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    SELECT a.id, a.code, a.name, a.type, a.is_active,
           (CASE WHEN a.type = 'income' THEN sum(l.credit) - sum(l.debit) ELSE sum(l.debit) - sum(l.credit) END)::numeric(14,2)
      FROM public.ledger_accounts a
      JOIN public.journal_lines l ON l.account_id = a.id
      JOIN public.journal_entries e ON e.id = l.entry_id AND e.organization_id = p_org AND e.entry_date BETWEEN p_from AND p_to
     WHERE a.organization_id = p_org AND a.type IN ('income', 'expense')
     GROUP BY a.id, a.code, a.name, a.type, a.is_active
     ORDER BY a.code;
END;
$function$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. Balance sheet as at a date. Asset, liability and equity accounts with a non-zero balance, signed to their normal
--    side (assets debit-positive; liabilities and equity credit-positive), plus one row code 'PL': income minus expenses
--    up to the date (no year-end close exists yet, so this is what makes the sheet balance). balanced (on every row):
--    assets = liabilities + equity, which double entry guarantees; it is shown, not assumed.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.ledger_report_balance_sheet(p_org uuid, p_as_of date)
 RETURNS TABLE(account_id uuid, code text, name text, type text, is_active boolean, balance numeric, balanced boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_rule text; v_as_of date := COALESCE(p_as_of, current_date);
BEGIN
  PERFORM public.require_aal2_if_enrolled();
  v_rule := public._ledger_rule(p_org, auth.uid());
  IF v_rule NOT IN ('ok', 'not_admin') THEN RAISE EXCEPTION 'LEDGER_%', upper(v_rule) USING ERRCODE = '42501'; END IF;
  RETURN QUERY
    WITH sums AS (
      SELECT a.id, a.code, a.name, a.type, a.is_active, COALESCE(sum(l.debit), 0) AS dr, COALESCE(sum(l.credit), 0) AS cr
        FROM public.ledger_accounts a
        JOIN public.journal_lines l ON l.account_id = a.id
        JOIN public.journal_entries e ON e.id = l.entry_id AND e.organization_id = p_org AND e.entry_date <= v_as_of
       WHERE a.organization_id = p_org
       GROUP BY a.id, a.code, a.name, a.type, a.is_active),
    bs_rows AS (
      SELECT s.id, s.code, s.name, s.type, s.is_active, (CASE WHEN s.type = 'asset' THEN s.dr - s.cr ELSE s.cr - s.dr END)::numeric(14,2) AS bal
        FROM sums s WHERE s.type IN ('asset', 'liability', 'equity') AND s.dr <> s.cr
      UNION ALL
      SELECT NULL::uuid, 'PL', 'Profit for the period (not yet closed to retained earnings)', 'equity', true,
             -- income minus expenses = (income credits - debits) - (expense debits - credits) = credits - debits over both
             COALESCE((SELECT sum(s.cr - s.dr) FROM sums s WHERE s.type IN ('income', 'expense')), 0)::numeric(14,2))
    SELECT r.id, r.code, r.name, r.type, r.is_active, r.bal,
           (SELECT COALESCE(sum(x.bal) FILTER (WHERE x.type = 'asset'), 0) = COALESCE(sum(x.bal) FILTER (WHERE x.type IN ('liability', 'equity')), 0) FROM bs_rows x)
      FROM bs_rows r
     ORDER BY CASE r.type WHEN 'asset' THEN 1 WHEN 'liability' THEN 2 ELSE 3 END, r.code = 'PL', r.code;
END;
$function$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. Account detail (nominal ledger): the balance before p_from, then every line in the range in order (entry date,
--    then the order journals were posted, then line number) with a running balance signed to the account's normal side,
--    and each line's source (manual, opening balance, reversal, or the posting label such as an invoice number). At most
--    2000 lines per call (truncated = true beyond; the totals and closing balance always cover the whole range).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.ledger_report_account_detail(p_org uuid, p_account uuid, p_from date, p_to date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_rule text; a public.ledger_accounts; v_sign integer; v_open numeric(14,2); v_dr numeric(14,2); v_cr numeric(14,2); v_n integer; v_rows jsonb;
BEGIN
  PERFORM public.require_aal2_if_enrolled();
  v_rule := public._ledger_rule(p_org, auth.uid());
  IF v_rule NOT IN ('ok', 'not_admin') THEN RAISE EXCEPTION 'LEDGER_%', upper(v_rule) USING ERRCODE = '42501'; END IF;
  SELECT * INTO a FROM public.ledger_accounts x WHERE x.id = p_account AND x.organization_id = p_org;
  IF NOT FOUND THEN RAISE EXCEPTION 'LEDGER_NOT_FOUND' USING ERRCODE = '22023'; END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to OR p_to >= (p_from + interval '5 years')::date THEN
    RAISE EXCEPTION 'LEDGER_BAD_RANGE' USING ERRCODE = '22023';
  END IF;
  v_sign := CASE WHEN a.normal_side = 'debit' THEN 1 ELSE -1 END;
  SELECT COALESCE(sum(l.debit - l.credit), 0) * v_sign INTO v_open
    FROM public.journal_lines l JOIN public.journal_entries e ON e.id = l.entry_id AND e.organization_id = p_org
   WHERE l.account_id = a.id AND e.entry_date < p_from;
  SELECT COALESCE(sum(l.debit), 0), COALESCE(sum(l.credit), 0), count(*) INTO v_dr, v_cr, v_n
    FROM public.journal_lines l JOIN public.journal_entries e ON e.id = l.entry_id AND e.organization_id = p_org
   WHERE l.account_id = a.id AND e.entry_date BETWEEN p_from AND p_to;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('entry_id', q.entry_id, 'entry_date', q.entry_date, 'source_type', q.source_type, 'source_label', q.source_label,
           'memo', q.memo, 'description', q.description, 'line_no', q.line_no, 'debit', q.debit, 'credit', q.credit, 'balance', q.balance) ORDER BY q.n), '[]'::jsonb)
    INTO v_rows
    FROM (SELECT z.*, (v_open + sum((z.debit - z.credit) * v_sign) OVER (ORDER BY z.n))::numeric(14,2) AS balance
            FROM (SELECT e.id AS entry_id, e.entry_date, e.source_type, e.memo, l.description, l.line_no, l.debit, l.credit,
                         COALESCE((SELECT p.source_label FROM public.ledger_postings p WHERE p.entry_id = e.id LIMIT 1),
                                  (SELECT p.source_label FROM public.ledger_postings p WHERE p.reversal_entry_id = e.id LIMIT 1)) AS source_label,
                         row_number() OVER (ORDER BY e.entry_date, e.posted_at, e.id, l.line_no) AS n
                    FROM public.journal_lines l JOIN public.journal_entries e ON e.id = l.entry_id AND e.organization_id = p_org
                   WHERE l.account_id = a.id AND e.entry_date BETWEEN p_from AND p_to) z
           WHERE z.n <= 2000) q;
  RETURN jsonb_build_object(
    'account', jsonb_build_object('id', a.id, 'code', a.code, 'name', a.name, 'type', a.type, 'normal_side', a.normal_side, 'is_active', a.is_active),
    'from', p_from, 'to', p_to, 'opening_balance', v_open, 'total_debit', v_dr, 'total_credit', v_cr,
    'closing_balance', (v_open + (v_dr - v_cr) * v_sign)::numeric(14,2), 'line_count', v_n, 'truncated', v_n > 2000, 'rows', v_rows);
END;
$function$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. How complete the books are, so a report is never read as final when it is not.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.ledger_report_completeness(p_org uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_rule text; s public.ledger_settings; x public.ledger_auto_settings;
BEGIN
  PERFORM public.require_aal2_if_enrolled();
  v_rule := public._ledger_rule(p_org, auth.uid());
  IF v_rule NOT IN ('ok', 'not_admin') THEN RAISE EXCEPTION 'LEDGER_%', upper(v_rule) USING ERRCODE = '42501'; END IF;
  SELECT * INTO s FROM public.ledger_settings WHERE organization_id = p_org;
  SELECT * INTO x FROM public.ledger_auto_settings WHERE organization_id = p_org;
  RETURN jsonb_build_object(
    'set_up', s.organization_id IS NOT NULL,
    'start_date', s.start_date,
    'locked_through', s.locked_through,
    'invoices_auto_on', COALESCE(x.invoices_enabled, false),
    'bills_auto_on', COALESCE(x.bills_enabled, false),
    'waiting', (SELECT count(DISTINCT q.source_id) FROM public.ledger_post_queue q WHERE q.organization_id = p_org),
    'open_issues', (SELECT count(*) FROM public.ledger_post_issues i WHERE i.organization_id = p_org AND i.resolved_at IS NULL),
    'last_posting_at', (SELECT max(e.posted_at) FROM public.journal_entries e WHERE e.organization_id = p_org),
    'bank_unmatched', (SELECT count(*) FROM public.ledger_bank_lines b WHERE b.organization_id = p_org AND b.status = 'unmatched'));
END;
$function$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['ledger_report_profit_loss(uuid,date,date)', 'ledger_report_balance_sheet(uuid,date)',
                           'ledger_report_account_detail(uuid,uuid,date,date)', 'ledger_report_completeness(uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, service_role', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname LIKE 'ledger_report_%'
              AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
                   OR p.provolatile <> 's' OR NOT p.prosecdef OR NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c = 'search_path=""'))) THEN
    RAISE EXCEPTION 'function privilege check failed';
  END IF;
END $$;

COMMIT;
