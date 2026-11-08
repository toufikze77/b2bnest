-- HMRC P6 rollback (one transaction). Removes the submissions table, its functions and the five audit events.
-- !!! REFUSES while any VAT submission or any P6 audit row exists: those are the permanent record of what was sent to
-- !!! HMRC (even the sandbox). There is no force switch on purpose. Unpublish the P6 frontend and undeploy
-- !!! hmrc-vat-submit first.
BEGIN;
DO $$ BEGIN
  IF to_regclass('public.hmrc_vat_submissions') IS NULL THEN RAISE EXCEPTION 'HMRC P6 is not applied'; END IF;
  IF EXISTS (SELECT 1 FROM public.hmrc_vat_submissions)
     OR EXISTS (SELECT 1 FROM public.hmrc_audit_log WHERE event IN ('vat_submit_start', 'vat_submit_result', 'vat_submit_unknown', 'vat_submit_check', 'fraud_validate')) THEN
    RAISE EXCEPTION 'VAT submissions (or their audit rows) exist: they are the permanent record and are not removed';
  END IF;
END $$;
DROP FUNCTION public.hmrc_begin_vat_submission(uuid, uuid, text, text, date, date, jsonb, text, uuid, text, text, text, integer);
DROP TABLE public.hmrc_vat_submissions;
DROP FUNCTION public._hmrc_vat_submission_guard();
ALTER TABLE public.hmrc_audit_log DROP CONSTRAINT hal_event;
ALTER TABLE public.hmrc_audit_log ADD CONSTRAINT hal_event CHECK (event IN ('connect_started', 'connected', 'refreshed', 'refresh_failed', 'disconnected', 'refused',
  'test_call', 'test_result', 'obligations_call', 'obligations_result'));
COMMIT;
