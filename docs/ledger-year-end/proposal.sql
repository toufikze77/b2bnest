-- =====================================================================================================================
-- Finance phase 5: financial year end for the ledger (close the year, lock the period). PREPARED, NOT APPLIED.
-- Read docs/ledger-year-end/README.md first. One transaction.
--
-- An owner or admin sets the company's financial year end (day and month). Closing a year posts ONE balanced journal
-- dated the year end (source_type 'year_end') that moves every income and expense balance to 3200 Retained earnings,
-- then locks the books through that date (ledger_settings.locked_through). Re-opening the most recent closed year
-- reverses that journal (a separate reversal journal, through the unchanged ledger_reverse_journal) and moves the lock
-- back to the previous year end. No new table: a closed year is the lock plus its year_end journal.
--
-- Changes to existing objects (the only ones):
--  * ledger_settings: new nullable columns financial_year_end_month, financial_year_end_day (+ CHECK ls_year_end).
--  * journal_entries.je_source_type: + 'year_end' (every existing value kept).
--  * CREATE OR REPLACE (same signatures and grants):
--      _ledger_settings_guard (phase 2): the lock may move backwards only inside ledger_year_end_reopen, for exactly the
--        move it names; the year end setting changes only while nothing is locked. Everything else unchanged.
--      ledger_report_profit_loss (phase 4): leaves out year_end journals and their reversals, so a closed year still
--        shows its real income and spending.
--  * New trigger ledger_year_end_guard (BEFORE INSERT) on journal_entries: a year_end journal is written only by the
--    close, and reversed only by the re-open (the Journals screen's Reverse is refused for it).
-- Not replaced (and why): ledger_report_balance_sheet already sums every journal up to the date, the close included,
--  so its "Profit for the period" is the profit since the last year end and 3200 holds the closed years (tested);
--  ledger_trial_balance (a trial balance after a close correctly shows the close journal); ledger_reverse_journal.
-- New: _ledger_ye_date, _ledger_ye_first, _ledger_ye_next, _ledger_ye_lines, _ledger_ye_warnings,
--  _ledger_year_end_entry_guard (internal); ledger_year_end_set, ledger_year_end_status, ledger_year_end_preview,
--  ledger_year_end_close, ledger_year_end_reopen (RPCs).
--
-- Production facts (22 Nov 2026, read read-only by the owner's assistant; PostgreSQL 17.12): 160 tables in public, md5
-- of the names sorted and joined with ',' = b9fec97b9d0d8c836c6af78125e92371; the constraints and columns below; md5
-- of each function body below as production stores it (accepted raw, without whole-line comments, or without any '--').
-- THE OWNER'S ASSISTANT RE-VERIFIES THESE BEFORE APPLYING; anything else: refused.
-- Rollback: docs/ledger-year-end/rollback.sql (refuses once any year_end journal exists). Tests: run-test.sh here.
-- =====================================================================================================================
BEGIN;

DO $$
DECLARE r record; v text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.ledger_settings'::regclass AND attname = 'financial_year_end_month' AND NOT attisdropped)
     OR to_regprocedure('public.ledger_year_end_close(uuid,date,boolean)') IS NOT NULL THEN
    RAISE EXCEPTION 'Finance phase 5 year end already exists (applied twice?)';
  END IF;
  IF (SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind IN ('r', 'p')) <> 160
     OR (SELECT md5(string_agg(relname, ',' ORDER BY relname)) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind IN ('r', 'p'))
        IS DISTINCT FROM 'b9fec97b9d0d8c836c6af78125e92371' THEN
    RAISE EXCEPTION 'the tables in public differ from production as read on 22 Nov 2026 (160 tables)';
  END IF;
  FOR r IN SELECT fn, array_agg(h) AS hs FROM (VALUES
      -- Replaced here:
      ('public._ledger_settings_guard()', 'cb0e157fa5a50c502488b2284bf751bb'),
      ('public.ledger_report_profit_loss(uuid,date,date)', '454e361e260262a419ced37829cef745'),
      -- Called or relied on, unchanged:
      ('public.ledger_report_balance_sheet(uuid,date)', '8f77d74be234303e6e3d18cbd174df6a'),
      ('public.ledger_trial_balance(uuid,date)', '5a165b9517c73e03556e9e5aab72c95e'),
      ('public.ledger_reverse_journal(uuid,text,date)', '22157acb97b8b8cb3ade3318177353b9'),
      ('public._ledger_post(uuid,date,text,text,jsonb,text,text,uuid)', '019a0b8e74b6d142e5623b09f7de27d6'),
      ('public._ledger_entry_guard()', '727748e665991e8105a96e15f7f9929c'),
      ('public._ledger_line_guard()', '041398b1d1ecbd5856c7cab85aff8479'),
      ('public._ledger_balance_check()', 'ee84f8fd18cb93fcd9fa1dfbd6aa36e7'),
      ('public._ledger_append_only()', 'f47e341b7cca2f0118e8e70493984e56'),
      ('public._ledger_rule(uuid,uuid)', 'edf2117e8b0bdeb3826552b712faa227'),
      ('public._ledger_require_writer(uuid)', '75ecf4a981581daae33e90dc554f01c4'),
      ('public.require_aal2_if_enrolled()', '10b2ae7bd2f9a94ea20598f19b8aebf2'),
      ('public.ledger_report_completeness(uuid)', '6d8cf9d49296fec90687f3ad0fb95acf'),
      ('public._ledger_bank_guard()', 'b6def894d0a6f851870b47f642268f3e')) x(fn, h) GROUP BY fn LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc p, LATERAL (SELECT regexp_replace(p.prosrc, E'\\n[ \\t]*--[^\\n]*', '', 'g') AS lines) c
                    WHERE p.oid = to_regprocedure(r.fn)
                      AND (md5(p.prosrc) = ANY (r.hs) OR md5(c.lines) = ANY (r.hs) OR md5(regexp_replace(c.lines, E'[ \\t]*--[^\\n]*', '', 'g')) = ANY (r.hs))) THEN
      RAISE EXCEPTION '% differs from the body this was written against (or is missing)', r.fn;
    END IF;
  END LOOP;
  FOR r IN SELECT * FROM (VALUES
      ('public.journal_entries', 'je_source_type', 'CHECK ((source_type = ANY (ARRAY[''manual''::text, ''opening_balance''::text, ''reversal''::text, ''auto_invoice''::text, ''auto_invoice_payment''::text, ''auto_bill''::text, ''auto_bill_payment''::text, ''auto_expense''::text, ''bank_line''::text])))'),
      ('public.journal_entries', 'je_reversal', 'CHECK (((source_type = ''reversal''::text) = (reverses_entry_id IS NOT NULL)))'),
      ('public.ledger_settings', 'ls_locked_through', 'CHECK (((locked_through IS NULL) OR (locked_through >= (start_date - 1))))')) c(t, n, d) LOOP
    SELECT pg_get_constraintdef(oid) INTO v FROM pg_constraint WHERE conrelid = r.t::regclass AND conname = r.n;
    IF v IS DISTINCT FROM r.d THEN RAISE EXCEPTION '%.% differs from what this was written against (%)', r.t, r.n, v; END IF;
  END LOOP;
  IF (SELECT string_agg(attname || ':' || format_type(atttypid, atttypmod), ',' ORDER BY attname) FROM pg_attribute
       WHERE attrelid = 'public.ledger_settings'::regclass AND attnum > 0 AND NOT attisdropped)
     IS DISTINCT FROM 'base_currency:text,created_at:timestamp with time zone,created_by:uuid,locked_through:date,opening_mode:text,organization_id:uuid,start_date:date' THEN
    RAISE EXCEPTION 'ledger_settings columns differ from what this was written against';
  END IF;
  IF (SELECT string_agg(tgname || ':' || tgfoid::regproc::text, ',' ORDER BY tgname) FROM pg_trigger WHERE tgrelid = 'public.journal_entries'::regclass AND NOT tgisinternal)
     IS DISTINCT FROM 'a0_demo_readonly_guard:demo_readonly_guard,data_rights_closed_company:_data_rights_closed_company_guard,ledger_append_only:_ledger_append_only,ledger_balanced:_ledger_balance_check,ledger_entry_guard:_ledger_entry_guard,ledger_no_truncate:_ledger_append_only' THEN
    RAISE EXCEPTION 'journal_entries triggers differ from what this was written against';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.ledger_settings'::regclass AND tgname = 'ledger_settings_guard' AND tgfoid = 'public._ledger_settings_guard()'::regprocedure) THEN
    RAISE EXCEPTION 'the ledger_settings_guard trigger differs from what this was written against';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. Columns and constraints.
-- ---------------------------------------------------------------------------------------------------------------------
ALTER TABLE public.ledger_settings
  ADD COLUMN financial_year_end_month smallint,
  ADD COLUMN financial_year_end_day smallint,
  ADD CONSTRAINT ls_year_end CHECK ((financial_year_end_month IS NULL) = (financial_year_end_day IS NULL)
    AND (financial_year_end_month IS NULL OR (financial_year_end_month BETWEEN 1 AND 12 AND financial_year_end_day BETWEEN 1 AND
         CASE financial_year_end_month WHEN 2 THEN 29 WHEN 4 THEN 30 WHEN 6 THEN 30 WHEN 9 THEN 30 WHEN 11 THEN 30 ELSE 31 END)));
COMMENT ON COLUMN public.ledger_settings.financial_year_end_month IS 'Finance phase 5: the company''s financial year end (month and day; 29 February means the last day of February). Set by ledger_year_end_set only.';

ALTER TABLE public.journal_entries DROP CONSTRAINT je_source_type;
ALTER TABLE public.journal_entries ADD CONSTRAINT je_source_type CHECK (source_type IN ('manual', 'opening_balance', 'reversal', 'auto_invoice', 'auto_invoice_payment',
  'auto_bill', 'auto_bill_payment', 'auto_expense', 'bank_line', 'year_end'));

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. Replaced functions (their phase 2 / phase 4 text with marked edits; grants kept by CREATE OR REPLACE).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._ledger_settings_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF public._data_rights_gate_is_open('company_close') THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'LEDGER_SETTINGS_FIXED: ledger settings go only with the company' USING ERRCODE = '42501';
  END IF;
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id OR NEW.opening_mode IS DISTINCT FROM OLD.opening_mode
     OR NEW.base_currency IS DISTINCT FROM OLD.base_currency OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'LEDGER_SETTINGS_FIXED' USING ERRCODE = '42501';
  END IF;
  IF NEW.start_date IS DISTINCT FROM OLD.start_date AND EXISTS (SELECT 1 FROM public.journal_entries e WHERE e.organization_id = OLD.organization_id) THEN
    RAISE EXCEPTION 'LEDGER_START_DATE_FIXED: the start date can''t change once a journal exists' USING ERRCODE = '42501';
  END IF;
  -- Finance phase 5: the only way back is ledger_year_end_reopen, which names this exact move (company, old lock, new
  -- lock) for its own transaction and reverses that year's close journal in the same transaction.
  IF NEW.locked_through IS DISTINCT FROM OLD.locked_through AND OLD.locked_through IS NOT NULL
     AND (NEW.locked_through IS NULL OR NEW.locked_through < OLD.locked_through)
     AND COALESCE(current_setting('ledger.year_end_reopen', true), '') IS DISTINCT FROM
         OLD.organization_id::text || ':' || OLD.locked_through::text || ':' || COALESCE(NEW.locked_through::text, '') THEN
    RAISE EXCEPTION 'LEDGER_LOCK_BACKWARDS: a locked period stays locked' USING ERRCODE = '42501';
  END IF;
  -- Finance phase 5: the financial year end changes only while no year is closed (nothing is locked).
  IF (NEW.financial_year_end_month, NEW.financial_year_end_day) IS DISTINCT FROM (OLD.financial_year_end_month, OLD.financial_year_end_day)
     AND OLD.locked_through IS NOT NULL THEN
    RAISE EXCEPTION 'LEDGER_YEAR_END_FIXED' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.ledger_report_profit_loss(p_org uuid, p_from date, p_to date)
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
       -- Finance phase 5: a year-end close (and its reversal on re-open) moves the year's result to retained earnings; it
       -- is not income or spending, so the year's real figures stay visible after the close.
       AND e.source_type <> 'year_end'
       AND NOT EXISTS (SELECT 1 FROM public.journal_entries y WHERE y.id = e.reverses_entry_id AND y.source_type = 'year_end')
     WHERE a.organization_id = p_org AND a.type IN ('income', 'expense')
     GROUP BY a.id, a.code, a.name, a.type, a.is_active
     ORDER BY a.code;
END;
$function$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. Year-end dates (pure helpers, no grants). 29 February as the year end means the last day of February.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public._ledger_ye_date(p_year integer, p_month integer, p_day integer)
 RETURNS date
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  SELECT make_date(p_year, p_month, CASE WHEN p_month = 2 AND p_day = 29 AND NOT (p_year % 4 = 0 AND (p_year % 100 <> 0 OR p_year % 400 = 0)) THEN 28 ELSE p_day END);
$function$;

-- The first year end after the start date (the first year may be shorter or longer than 12 months).
CREATE FUNCTION public._ledger_ye_first(p_start date, p_month integer, p_day integer)
 RETURNS date
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  SELECT CASE WHEN public._ledger_ye_date(extract(year FROM p_start)::integer, p_month, p_day) > p_start
              THEN public._ledger_ye_date(extract(year FROM p_start)::integer, p_month, p_day)
              ELSE public._ledger_ye_date(extract(year FROM p_start)::integer + 1, p_month, p_day) END;
$function$;

-- The next year end that can be closed: the first scheduled year end after the lock (or after the start date).
CREATE FUNCTION public._ledger_ye_next(p_start date, p_locked date, p_month integer, p_day integer)
 RETURNS date
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  SELECT CASE WHEN p_locked IS NULL OR p_locked < public._ledger_ye_first(p_start, p_month, p_day) THEN public._ledger_ye_first(p_start, p_month, p_day)
              WHEN public._ledger_ye_date(extract(year FROM p_locked)::integer, p_month, p_day) > p_locked
                THEN public._ledger_ye_date(extract(year FROM p_locked)::integer, p_month, p_day)
              ELSE public._ledger_ye_date(extract(year FROM p_locked)::integer + 1, p_month, p_day) END;
$function$;

-- What the close would move: each income and expense account's balance up to the year end (earlier years are already
-- closed, so this is the year's own result), signed debit minus credit.
CREATE FUNCTION public._ledger_ye_lines(p_org uuid, p_year_end date)
 RETURNS TABLE(account_id uuid, code text, name text, type text, is_active boolean, net numeric)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT a.id, a.code, a.name, a.type, a.is_active, (sum(l.debit) - sum(l.credit))::numeric(14,2)
    FROM public.ledger_accounts a
    JOIN public.journal_lines l ON l.account_id = a.id
    JOIN public.journal_entries e ON e.id = l.entry_id AND e.organization_id = p_org AND e.entry_date <= p_year_end
   WHERE a.organization_id = p_org AND a.type IN ('income', 'expense')
   GROUP BY a.id, a.code, a.name, a.type, a.is_active
  HAVING sum(l.debit) <> sum(l.credit)
   ORDER BY a.code;
$function$;

-- What may be missing from the year: records waiting to post or held (their document dated in the year) and bank
-- statement lines in the year that match nothing.
CREATE FUNCTION public._ledger_ye_warnings(p_org uuid, p_from date, p_to date)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  WITH docs AS (
    SELECT 'invoices'::text AS t, i.id, COALESCE(i.tax_point_date, i.created_at::date) AS d, i.paid_at::date AS paid FROM public.invoices i WHERE i.organization_id = p_org
    UNION ALL SELECT 'bills', b.id, COALESCE(b.tax_point_date, b.issue_date), b.paid_date FROM public.bills b WHERE b.organization_id = p_org
    UNION ALL SELECT 'expenses', x.id, COALESCE(x.tax_point_date, x.date), NULL FROM public.expenses x WHERE x.organization_id = p_org)
  SELECT jsonb_build_object(
    'waiting', (SELECT count(DISTINCT q.source_id) FROM public.ledger_post_queue q JOIN docs ON docs.t = q.source_table AND docs.id = q.source_id
                 WHERE q.organization_id = p_org AND (docs.d BETWEEN p_from AND p_to OR docs.paid BETWEEN p_from AND p_to)),
    'held', (SELECT count(*) FROM public.ledger_post_issues i JOIN docs ON docs.t = i.source_table AND docs.id = i.source_id
              WHERE i.organization_id = p_org AND i.resolved_at IS NULL
                AND (CASE WHEN i.kind IN ('invoice_paid', 'bill_paid') THEN docs.paid ELSE docs.d END) BETWEEN p_from AND p_to),
    'bank_unmatched', (SELECT count(*) FROM public.ledger_bank_lines b WHERE b.organization_id = p_org AND b.status = 'unmatched' AND b.line_date BETWEEN p_from AND p_to));
$function$;

-- A year_end journal is written only by the close, and reversed only by the re-open (each names the company for its own
-- transaction). The Journals screen's Reverse, and any other path, is refused for it.
CREATE FUNCTION public._ledger_year_end_entry_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.source_type = 'year_end' AND COALESCE(current_setting('ledger.year_end_close', true), '') IS DISTINCT FROM NEW.organization_id::text THEN
    RAISE EXCEPTION 'LEDGER_YEAR_END_ONLY_BY_CLOSE: a year-end journal is posted only by closing the year' USING ERRCODE = '42501';
  END IF;
  IF NEW.reverses_entry_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.journal_entries y WHERE y.id = NEW.reverses_entry_id AND y.source_type = 'year_end')
     AND COALESCE(current_setting('ledger.year_end_reopen', true), '') NOT LIKE NEW.organization_id::text || ':%' THEN
    RAISE EXCEPTION 'LEDGER_YEAR_END_REOPEN_ONLY: a year-end close is undone only by re-opening the year' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER ledger_year_end_guard BEFORE INSERT ON public.journal_entries FOR EACH ROW EXECUTE FUNCTION public._ledger_year_end_entry_guard();

REVOKE ALL ON FUNCTION public._ledger_ye_date(integer, integer, integer), public._ledger_ye_first(date, integer, integer), public._ledger_ye_next(date, date, integer, integer),
  public._ledger_ye_lines(uuid, date), public._ledger_ye_warnings(uuid, date, date), public._ledger_year_end_entry_guard() FROM PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. RPCs.
-- ---------------------------------------------------------------------------------------------------------------------
-- Status (members read; the same rule as the trial balance).
CREATE FUNCTION public.ledger_year_end_status(p_org uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_rule text; s public.ledger_settings; v_first date; v_next date; v_closed jsonb := '[]'::jsonb; y date; v_prev date;
BEGIN
  PERFORM public.require_aal2_if_enrolled();
  v_rule := public._ledger_rule(p_org, auth.uid());
  IF v_rule NOT IN ('ok', 'not_admin') THEN RAISE EXCEPTION 'LEDGER_%', upper(v_rule) USING ERRCODE = '42501'; END IF;
  SELECT * INTO s FROM public.ledger_settings WHERE organization_id = p_org;
  IF NOT FOUND THEN RETURN jsonb_build_object('set_up', false, 'can_manage', v_rule = 'ok'); END IF;
  IF s.financial_year_end_month IS NOT NULL THEN
    v_first := public._ledger_ye_first(s.start_date, s.financial_year_end_month, s.financial_year_end_day);
    v_next := public._ledger_ye_next(s.start_date, s.locked_through, s.financial_year_end_month, s.financial_year_end_day);
    y := v_first; v_prev := s.start_date - 1;
    WHILE s.locked_through IS NOT NULL AND y <= s.locked_through LOOP
      v_closed := v_closed || jsonb_build_array(jsonb_build_object('year_end', y, 'year_start', v_prev + 1,
        'entry_id', (SELECT e.id FROM public.journal_entries e WHERE e.organization_id = p_org AND e.source_type = 'year_end' AND e.entry_date = y
                      AND NOT EXISTS (SELECT 1 FROM public.journal_entries r WHERE r.reverses_entry_id = e.id)),
        'profit', COALESCE((SELECT sum(l.credit - l.debit) FROM public.journal_lines l JOIN public.journal_entries e ON e.id = l.entry_id
                             JOIN public.ledger_accounts a ON a.id = l.account_id AND a.system_key = 'retained_earnings'
                            WHERE e.organization_id = p_org AND e.source_type = 'year_end' AND e.entry_date = y
                              AND NOT EXISTS (SELECT 1 FROM public.journal_entries r WHERE r.reverses_entry_id = e.id)), 0)::numeric(14,2)));
      v_prev := y;
      y := public._ledger_ye_date(extract(year FROM y)::integer + 1, s.financial_year_end_month, s.financial_year_end_day);
    END LOOP;
  END IF;
  RETURN jsonb_build_object('set_up', true, 'can_manage', v_rule = 'ok', 'start_date', s.start_date, 'locked_through', s.locked_through,
    'year_end_month', s.financial_year_end_month, 'year_end_day', s.financial_year_end_day, 'first_year_end', v_first,
    'closed_years', v_closed, 'next_year_end', v_next,
    'next_year_start', CASE WHEN v_next IS NULL THEN NULL WHEN v_next = v_first THEN s.start_date
                            ELSE public._ledger_ye_date(extract(year FROM v_next)::integer - 1, s.financial_year_end_month, s.financial_year_end_day) + 1 END,
    'can_close_now', v_next IS NOT NULL AND v_next <= current_date,
    'latest_closed', (SELECT max((c ->> 'year_end')::date) FROM jsonb_array_elements(v_closed) c));
END;
$function$;

-- Set or change the financial year end (only while no year is closed).
CREATE FUNCTION public.ledger_year_end_set(p_org uuid, p_month integer, p_day integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE s public.ledger_settings;
BEGIN
  PERFORM public._ledger_require_writer(p_org);
  IF p_month IS NULL OR p_day IS NULL OR p_month NOT BETWEEN 1 AND 12
     OR p_day NOT BETWEEN 1 AND (CASE p_month WHEN 2 THEN 29 WHEN 4 THEN 30 WHEN 6 THEN 30 WHEN 9 THEN 30 WHEN 11 THEN 30 ELSE 31 END) THEN
    RAISE EXCEPTION 'LEDGER_YEAR_END_BAD_DATE' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('ledger:' || p_org::text, 0));
  SELECT * INTO s FROM public.ledger_settings WHERE organization_id = p_org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'LEDGER_NOT_SET_UP' USING ERRCODE = '22023'; END IF;
  IF (s.financial_year_end_month, s.financial_year_end_day) IS NOT DISTINCT FROM (p_month::smallint, p_day::smallint) THEN
    RETURN jsonb_build_object('result', 'unchanged');
  END IF;
  IF s.locked_through IS NOT NULL THEN RAISE EXCEPTION 'LEDGER_YEAR_END_FIXED' USING ERRCODE = '22023'; END IF;
  UPDATE public.ledger_settings SET financial_year_end_month = p_month, financial_year_end_day = p_day WHERE organization_id = p_org;
  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, details)
  VALUES (auth.uid(), 'ledger.year_end_set', 'ledger_settings', p_org::text,
          jsonb_build_object('organization_id', p_org, 'month', p_month, 'day', p_day, 'was_month', s.financial_year_end_month, 'was_day', s.financial_year_end_day));
  RETURN jsonb_build_object('result', 'saved', 'first_year_end', public._ledger_ye_first(s.start_date, p_month, p_day));
END;
$function$;

-- Exactly what closing would do (members read). problem: why it can't be closed now (null when it can).
CREATE FUNCTION public.ledger_year_end_preview(p_org uuid, p_year_end date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_rule text; s public.ledger_settings; v_first date; v_next date; v_start date; v_lines jsonb; v_profit numeric(14,2); v_warn jsonb; v_problem text;
BEGIN
  PERFORM public.require_aal2_if_enrolled();
  v_rule := public._ledger_rule(p_org, auth.uid());
  IF v_rule NOT IN ('ok', 'not_admin') THEN RAISE EXCEPTION 'LEDGER_%', upper(v_rule) USING ERRCODE = '42501'; END IF;
  SELECT * INTO s FROM public.ledger_settings WHERE organization_id = p_org;
  IF NOT FOUND THEN RAISE EXCEPTION 'LEDGER_NOT_SET_UP' USING ERRCODE = '22023'; END IF;
  IF s.financial_year_end_month IS NULL THEN RAISE EXCEPTION 'LEDGER_YEAR_END_NOT_SET' USING ERRCODE = '22023'; END IF;
  v_first := public._ledger_ye_first(s.start_date, s.financial_year_end_month, s.financial_year_end_day);
  IF p_year_end IS NULL OR p_year_end < v_first OR p_year_end <> public._ledger_ye_date(extract(year FROM p_year_end)::integer, s.financial_year_end_month, s.financial_year_end_day) THEN
    RAISE EXCEPTION 'LEDGER_YEAR_END_BAD_DATE' USING ERRCODE = '22023';
  END IF;
  v_next := public._ledger_ye_next(s.start_date, s.locked_through, s.financial_year_end_month, s.financial_year_end_day);
  v_start := CASE WHEN p_year_end = v_first THEN s.start_date
                  ELSE public._ledger_ye_date(extract(year FROM p_year_end)::integer - 1, s.financial_year_end_month, s.financial_year_end_day) + 1 END;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('account_id', x.account_id, 'code', x.code, 'name', x.name, 'type', x.type, 'is_active', x.is_active,
           'debit', CASE WHEN x.net < 0 THEN -x.net ELSE 0 END::numeric(14,2), 'credit', CASE WHEN x.net > 0 THEN x.net ELSE 0 END::numeric(14,2)) ORDER BY x.code), '[]'::jsonb),
         COALESCE(-sum(x.net), 0)::numeric(14,2)
    INTO v_lines, v_profit FROM public._ledger_ye_lines(p_org, p_year_end) x;
  v_warn := public._ledger_ye_warnings(p_org, v_start, p_year_end);
  v_problem := CASE WHEN s.locked_through IS NOT NULL AND p_year_end <= s.locked_through THEN 'already_closed'
                    WHEN p_year_end > v_next THEN 'out_of_order'
                    WHEN p_year_end > current_date THEN 'future'
                    WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(v_lines) l WHERE NOT (l ->> 'is_active')::boolean) THEN 'inactive_account'
                    WHEN NOT EXISTS (SELECT 1 FROM public.ledger_accounts a WHERE a.organization_id = p_org AND a.system_key = 'retained_earnings' AND a.is_active) THEN 'no_retained_earnings' END;
  RETURN jsonb_build_object('year_start', v_start, 'year_end', p_year_end, 'lock_date', p_year_end, 'lines', v_lines, 'profit', v_profit,
    'retained_earnings', jsonb_build_object('debit', CASE WHEN v_profit < 0 THEN -v_profit ELSE 0 END::numeric(14,2), 'credit', CASE WHEN v_profit > 0 THEN v_profit ELSE 0 END::numeric(14,2)),
    'warnings', v_warn, 'needs_acknowledgement', (v_warn ->> 'waiting')::int + (v_warn ->> 'held')::int + (v_warn ->> 'bank_unmatched')::int > 0,
    'problem', v_problem, 'can_manage', v_rule = 'ok');
END;
$function$;

-- Close a year: one journal dated the year end moving the year's result to 3200, then lock through the year end.
-- Again for a closed year: unchanged. A year with no income or spending: no journal; the books are still locked.
CREATE FUNCTION public.ledger_year_end_close(p_org uuid, p_year_end date, p_acknowledge boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE s public.ledger_settings; v_first date; v_next date; v_start date; v_warn jsonb; v_entry uuid; v_name text; v_profit numeric(14,2); v_re uuid; v_i integer := 0; x record;
BEGIN
  PERFORM public._ledger_require_writer(p_org);
  PERFORM pg_advisory_xact_lock(hashtextextended('ledger:' || p_org::text, 0));
  SELECT * INTO s FROM public.ledger_settings WHERE organization_id = p_org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'LEDGER_NOT_SET_UP' USING ERRCODE = '22023'; END IF;
  IF s.financial_year_end_month IS NULL THEN RAISE EXCEPTION 'LEDGER_YEAR_END_NOT_SET' USING ERRCODE = '22023'; END IF;
  v_first := public._ledger_ye_first(s.start_date, s.financial_year_end_month, s.financial_year_end_day);
  IF p_year_end IS NULL OR p_year_end < v_first OR p_year_end <> public._ledger_ye_date(extract(year FROM p_year_end)::integer, s.financial_year_end_month, s.financial_year_end_day) THEN
    RAISE EXCEPTION 'LEDGER_YEAR_END_BAD_DATE' USING ERRCODE = '22023';
  END IF;
  IF s.locked_through IS NOT NULL AND p_year_end <= s.locked_through THEN
    RETURN jsonb_build_object('result', 'unchanged', 'year_end', p_year_end, 'locked_through', s.locked_through);
  END IF;
  v_next := public._ledger_ye_next(s.start_date, s.locked_through, s.financial_year_end_month, s.financial_year_end_day);
  IF p_year_end > v_next THEN RAISE EXCEPTION 'LEDGER_YEAR_END_OUT_OF_ORDER' USING ERRCODE = '22023'; END IF;
  IF p_year_end > current_date THEN RAISE EXCEPTION 'LEDGER_YEAR_END_FUTURE' USING ERRCODE = '22023'; END IF;
  v_start := CASE WHEN p_year_end = v_first THEN s.start_date
                  ELSE public._ledger_ye_date(extract(year FROM p_year_end)::integer - 1, s.financial_year_end_month, s.financial_year_end_day) + 1 END;
  v_warn := public._ledger_ye_warnings(p_org, v_start, p_year_end);
  IF (v_warn ->> 'waiting')::int + (v_warn ->> 'held')::int + (v_warn ->> 'bank_unmatched')::int > 0 AND NOT COALESCE(p_acknowledge, false) THEN
    RAISE EXCEPTION 'LEDGER_YEAR_END_NEEDS_ACK' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public._ledger_ye_lines(p_org, p_year_end) l WHERE NOT l.is_active) THEN
    RAISE EXCEPTION 'LEDGER_YEAR_END_INACTIVE_ACCOUNT' USING ERRCODE = '22023';
  END IF;
  SELECT a.id INTO v_re FROM public.ledger_accounts a WHERE a.organization_id = p_org AND a.system_key = 'retained_earnings' AND a.is_active;
  IF v_re IS NULL THEN RAISE EXCEPTION 'LEDGER_YEAR_END_NO_RETAINED_EARNINGS' USING ERRCODE = '22023'; END IF;
  SELECT COALESCE(-sum(l.net), 0)::numeric(14,2) INTO v_profit FROM public._ledger_ye_lines(p_org, p_year_end) l;
  IF EXISTS (SELECT 1 FROM public._ledger_ye_lines(p_org, p_year_end)) THEN
    SELECT COALESCE(NULLIF(btrim(p.display_name), ''), NULLIF(btrim(p.full_name), '')) INTO v_name FROM public.profiles p WHERE p.id = auth.uid();
    PERFORM set_config('ledger.year_end_close', p_org::text, true);
    INSERT INTO public.journal_entries (organization_id, entry_date, memo, reason, source_type, posted_by, posted_by_name)
    VALUES (p_org, p_year_end, 'Year end close: year ending ' || to_char(p_year_end, 'DD/MM/YYYY'), 'Year end close ' || to_char(p_year_end, 'YYYY'),
            'year_end', auth.uid(), left(v_name, 120))
    RETURNING id INTO v_entry;
    PERFORM set_config('ledger.year_end_close', '', true);
    PERFORM set_config('ledger.posting_entry', v_entry::text, true);
    FOR x IN SELECT * FROM public._ledger_ye_lines(p_org, p_year_end) LOOP
      v_i := v_i + 1;
      INSERT INTO public.journal_lines (entry_id, organization_id, account_id, line_no, debit, credit, description)
      VALUES (v_entry, p_org, x.account_id, v_i, CASE WHEN x.net < 0 THEN -x.net ELSE 0 END, CASE WHEN x.net > 0 THEN x.net ELSE 0 END, left(x.name, 200));
    END LOOP;
    IF v_profit <> 0 THEN
      INSERT INTO public.journal_lines (entry_id, organization_id, account_id, line_no, debit, credit, description)
      VALUES (v_entry, p_org, v_re, v_i + 1, CASE WHEN v_profit < 0 THEN -v_profit ELSE 0 END, CASE WHEN v_profit > 0 THEN v_profit ELSE 0 END, 'Retained earnings');
    END IF;
    PERFORM set_config('ledger.posting_entry', '', true);
    SET CONSTRAINTS public.ledger_balanced IMMEDIATE;
    SET CONSTRAINTS public.ledger_balanced DEFERRED;
  END IF;
  UPDATE public.ledger_settings SET locked_through = p_year_end WHERE organization_id = p_org;
  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, details)
  VALUES (auth.uid(), 'ledger.year_end_close', 'ledger_settings', p_org::text,
          jsonb_build_object('organization_id', p_org, 'year_start', v_start, 'year_end', p_year_end, 'entry_id', v_entry, 'profit', v_profit,
                             'acknowledged', COALESCE(p_acknowledge, false), 'warnings', v_warn));
  RETURN jsonb_build_object('result', 'closed', 'year_end', p_year_end, 'entry_id', v_entry, 'profit', v_profit, 'locked_through', p_year_end);
END;
$function$;

-- Re-open the most recent closed year: move the lock back to the previous year end (or none), then reverse the close
-- journal on its own date with the unchanged ledger_reverse_journal.
CREATE FUNCTION public.ledger_year_end_reopen(p_org uuid, p_year_end date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE s public.ledger_settings; v_first date; v_prev date; v_entry uuid; v_rev uuid;
BEGIN
  PERFORM public._ledger_require_writer(p_org);
  PERFORM pg_advisory_xact_lock(hashtextextended('ledger:' || p_org::text, 0));
  SELECT * INTO s FROM public.ledger_settings WHERE organization_id = p_org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'LEDGER_NOT_SET_UP' USING ERRCODE = '22023'; END IF;
  IF s.financial_year_end_month IS NULL THEN RAISE EXCEPTION 'LEDGER_YEAR_END_NOT_SET' USING ERRCODE = '22023'; END IF;
  IF p_year_end IS NULL OR s.locked_through IS NULL OR p_year_end > s.locked_through THEN RAISE EXCEPTION 'LEDGER_YEAR_END_NOT_CLOSED' USING ERRCODE = '22023'; END IF;
  IF p_year_end < s.locked_through THEN RAISE EXCEPTION 'LEDGER_YEAR_END_NOT_LATEST' USING ERRCODE = '22023'; END IF;
  v_first := public._ledger_ye_first(s.start_date, s.financial_year_end_month, s.financial_year_end_day);
  IF p_year_end < v_first OR p_year_end <> public._ledger_ye_date(extract(year FROM p_year_end)::integer, s.financial_year_end_month, s.financial_year_end_day) THEN
    RAISE EXCEPTION 'LEDGER_YEAR_END_BAD_DATE' USING ERRCODE = '22023';
  END IF;
  v_prev := CASE WHEN p_year_end = v_first THEN NULL
                 ELSE public._ledger_ye_date(extract(year FROM p_year_end)::integer - 1, s.financial_year_end_month, s.financial_year_end_day) END;
  PERFORM set_config('ledger.year_end_reopen', p_org::text || ':' || p_year_end::text || ':' || COALESCE(v_prev::text, ''), true);
  UPDATE public.ledger_settings SET locked_through = v_prev WHERE organization_id = p_org;
  SELECT e.id INTO v_entry FROM public.journal_entries e WHERE e.organization_id = p_org AND e.source_type = 'year_end' AND e.entry_date = p_year_end
     AND NOT EXISTS (SELECT 1 FROM public.journal_entries r WHERE r.reverses_entry_id = e.id);
  IF v_entry IS NOT NULL THEN
    v_rev := (public.ledger_reverse_journal(v_entry, 'Year end re-opened ' || to_char(p_year_end, 'YYYY'), p_year_end) ->> 'entry_id')::uuid;
  END IF;
  PERFORM set_config('ledger.year_end_reopen', '', true);
  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, details)
  VALUES (auth.uid(), 'ledger.year_end_reopen', 'ledger_settings', p_org::text,
          jsonb_build_object('organization_id', p_org, 'year_end', p_year_end, 'entry_id', v_entry, 'reversal_entry_id', v_rev, 'locked_through', v_prev));
  RETURN jsonb_build_object('result', 'reopened', 'year_end', p_year_end, 'reversal_entry_id', v_rev, 'locked_through', v_prev);
END;
$function$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['ledger_year_end_status(uuid)', 'ledger_year_end_set(uuid,integer,integer)', 'ledger_year_end_preview(uuid,date)',
                           'ledger_year_end_close(uuid,date,boolean)', 'ledger_year_end_reopen(uuid,date)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, service_role', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND (p.proname LIKE 'ledger_year_end%' OR p.proname LIKE '_ledger_ye%' OR p.proname = '_ledger_year_end_entry_guard')
              AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c = 'search_path=""')))
     OR has_function_privilege('authenticated', 'public._ledger_ye_lines(uuid,date)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.ledger_report_profit_loss(uuid,date,date)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.ledger_report_profit_loss(uuid,date,date)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public._ledger_settings_guard()', 'EXECUTE') THEN
    RAISE EXCEPTION 'function privilege check failed';
  END IF;
END $$;

COMMIT;
