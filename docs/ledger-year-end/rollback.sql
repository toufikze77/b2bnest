-- =====================================================================================================================
-- Finance phase 5 rollback (docs/ledger-year-end/proposal.sql). Puts the ledger back exactly as before: the two replaced
-- functions (their phase 2 and phase 4 bodies), je_source_type, and drops the new trigger, functions and columns.
-- Refuses once any year_end journal exists (closed, or closed and re-opened): journals are never deleted, so the
-- 'year_end' journal type must then stay. Also refuses once any year was closed without a journal (a year with no income
-- or spending; its audit row shows it). A year end that is set but never used is simply dropped with its columns.
-- =====================================================================================================================
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.ledger_settings'::regclass AND attname = 'financial_year_end_month' AND NOT attisdropped) THEN
    RAISE EXCEPTION 'Finance phase 5 is not applied';
  END IF;
  IF EXISTS (SELECT 1 FROM public.journal_entries WHERE source_type = 'year_end') THEN
    RAISE EXCEPTION 'journal_entries holds % year-end journals (a year was closed). Journals are never deleted, so the year_end journal type must stay: leave phase 5 in place.',
      (SELECT count(*) FROM public.journal_entries WHERE source_type = 'year_end');
  END IF;
  IF EXISTS (SELECT 1 FROM public.audit_logs WHERE action = 'ledger.year_end_close') THEN
    RAISE EXCEPTION 'a year has been closed (% close records in audit_logs; a year with no income or spending closes without a journal). Leave phase 5 in place.',
      (SELECT count(*) FROM public.audit_logs WHERE action = 'ledger.year_end_close');
  END IF;
END $$;
DROP FUNCTION public.ledger_year_end_reopen(uuid, date);
DROP FUNCTION public.ledger_year_end_close(uuid, date, boolean);
DROP FUNCTION public.ledger_year_end_preview(uuid, date);
DROP FUNCTION public.ledger_year_end_set(uuid, integer, integer);
DROP FUNCTION public.ledger_year_end_status(uuid);
DROP TRIGGER ledger_year_end_guard ON public.journal_entries;
DROP FUNCTION public._ledger_year_end_entry_guard();
DROP FUNCTION public._ledger_ye_warnings(uuid, date, date);
DROP FUNCTION public._ledger_ye_lines(uuid, date);
DROP FUNCTION public._ledger_ye_next(date, date, integer, integer);
DROP FUNCTION public._ledger_ye_first(date, integer, integer);
DROP FUNCTION public._ledger_ye_date(integer, integer, integer);

-- The phase 2 and phase 4 bodies, exactly as docs/ledger/proposal.sql and docs/ledger-reports/proposal.sql created them
-- (grants are kept by CREATE OR REPLACE). The guard first, so the columns can then go.
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
  IF NEW.locked_through IS DISTINCT FROM OLD.locked_through AND OLD.locked_through IS NOT NULL
     AND (NEW.locked_through IS NULL OR NEW.locked_through < OLD.locked_through) THEN
    RAISE EXCEPTION 'LEDGER_LOCK_BACKWARDS: a locked period stays locked' USING ERRCODE = '42501';
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
     WHERE a.organization_id = p_org AND a.type IN ('income', 'expense')
     GROUP BY a.id, a.code, a.name, a.type, a.is_active
     ORDER BY a.code;
END;
$function$;

ALTER TABLE public.ledger_settings DROP CONSTRAINT ls_year_end, DROP COLUMN financial_year_end_month, DROP COLUMN financial_year_end_day;
ALTER TABLE public.journal_entries DROP CONSTRAINT je_source_type;
ALTER TABLE public.journal_entries ADD CONSTRAINT je_source_type CHECK (source_type IN ('manual', 'opening_balance', 'reversal', 'auto_invoice', 'auto_invoice_payment',
  'auto_bill', 'auto_bill_payment', 'auto_expense', 'bank_line'));
COMMIT;
