-- Finance phase 3a rollback (one transaction): removes automatic postings and puts journal_entries.je_source_type back
-- to its phase 2 values. Refuses while any automatic posting exists: journals are append-only business records, so an
-- automatic journal can't be removed and the old CHECK would no longer hold. (Switching automatic postings off is the
-- way to stop them; it keeps every journal.)
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.ledger_postings') IS NULL THEN RAISE EXCEPTION 'Finance phase 3a is not applied'; END IF;
  IF EXISTS (SELECT 1 FROM public.ledger_postings)
     OR EXISTS (SELECT 1 FROM public.journal_entries WHERE source_type IN ('auto_invoice', 'auto_invoice_payment')) THEN
    RAISE EXCEPTION 'the ledger holds automatic postings: rollback refused (switch automatic postings off instead)';
  END IF;
END $$;

DROP TRIGGER ledger_auto_invoice ON public.invoices;
DROP FUNCTION public.ledger_auto_run(uuid);
DROP FUNCTION public.ledger_auto_catch_up(uuid);
DROP FUNCTION public.ledger_auto_preview(uuid);
DROP FUNCTION public.ledger_auto_set(uuid, boolean);
DROP FUNCTION public.ledger_auto_status(uuid);
DROP FUNCTION public.ledger_process_queue(uuid, integer);
DROP FUNCTION public._ledger_auto_org_ready(uuid);
DROP FUNCTION public._ledger_auto_apply(uuid, uuid);
DROP FUNCTION public._ledger_auto_issue(uuid, uuid, text, text, text);
DROP FUNCTION public._ledger_auto_journal(uuid, date, text, text, uuid, uuid, jsonb, uuid);
DROP FUNCTION public._ledger_auto_plan(uuid, uuid);
DROP FUNCTION public._ledger_auto_pence(numeric);
DROP FUNCTION public._ledger_auto_invoice_changed();
DROP TABLE public.ledger_post_issues;
DROP TABLE public.ledger_postings;
DROP TABLE public.ledger_post_queue;
DROP TABLE public.ledger_auto_settings;
DROP FUNCTION public._ledger_auto_history_guard();

ALTER TABLE public.journal_entries DROP CONSTRAINT je_source_type;
ALTER TABLE public.journal_entries ADD CONSTRAINT je_source_type CHECK (source_type IN ('manual', 'opening_balance', 'reversal'));

COMMIT;
