-- =====================================================================================================================
-- Finance phase 3c-1 rollback: removes the bank statement tables and functions (docs/ledger-bank/proposal.sql).
-- Refuses while any statement line exists: lines are company records (export the company first, then decide).
-- Bank accounts and imports with no lines are removed with the tables. The ledger itself was never changed by 3c-1,
-- so nothing else needs undoing. Audit rows written by 3c-1 stay in audit_logs.
-- =====================================================================================================================
BEGIN;
DO $$
BEGIN
  IF to_regclass('public.ledger_bank_lines') IS NULL THEN RAISE EXCEPTION 'Finance phase 3c-1 is not applied'; END IF;
  IF EXISTS (SELECT 1 FROM public.ledger_bank_lines) THEN
    RAISE EXCEPTION 'ledger_bank_lines holds bank statement lines (% of them): they are company records, so the rollback stops here. Export the companies concerned first.',
      (SELECT count(*) FROM public.ledger_bank_lines);
  END IF;
END $$;
DROP FUNCTION public.ledger_bank_overview(uuid, uuid, date, integer);
DROP FUNCTION public.ledger_bank_unignore(uuid, uuid);
DROP FUNCTION public.ledger_bank_ignore(uuid, uuid, text);
DROP FUNCTION public.ledger_bank_unmatch(uuid, uuid);
DROP FUNCTION public.ledger_bank_match(uuid, uuid, uuid);
DROP FUNCTION public.ledger_bank_match_run(uuid, uuid);
DROP FUNCTION public.ledger_bank_import(uuid, uuid, text, jsonb);
DROP FUNCTION public.ledger_bank_account_save(uuid, uuid, text, text, boolean);
DROP FUNCTION public._ledger_bank_match_run(uuid, uuid);
DROP FUNCTION public._ledger_bank_open_payments(uuid, uuid);
DROP FUNCTION public._ledger_bank_posting_pence(uuid, uuid);
DROP FUNCTION public._ledger_bank_try_date(text);
DROP FUNCTION public._ledger_bank_audit(text, text, uuid, jsonb);
-- The guard allows deletes only through the company-close gate, so the empty tables are dropped (not emptied).
DROP TABLE public.ledger_bank_lines;
DROP TABLE public.ledger_bank_imports;
DROP TABLE public.ledger_bank_accounts;
DROP FUNCTION public._ledger_bank_guard();
COMMIT;
