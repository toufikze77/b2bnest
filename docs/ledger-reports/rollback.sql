-- =====================================================================================================================
-- Finance phase 4 rollback: drops the four read-only report functions (docs/ledger-reports/proposal.sql). Nothing else
-- was added or changed by phase 4, and the reports store nothing, so nothing else needs undoing.
-- =====================================================================================================================
BEGIN;
DO $$
BEGIN
  IF to_regprocedure('public.ledger_report_profit_loss(uuid,date,date)') IS NULL THEN RAISE EXCEPTION 'Finance phase 4 ledger reports are not applied'; END IF;
END $$;
DROP FUNCTION public.ledger_report_profit_loss(uuid, date, date);
DROP FUNCTION public.ledger_report_balance_sheet(uuid, date);
DROP FUNCTION public.ledger_report_account_detail(uuid, uuid, date, date);
DROP FUNCTION public.ledger_report_completeness(uuid);
COMMIT;
