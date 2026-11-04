-- =====================================================================================================================
-- HMRC P1 + P2 rollback (one transaction): drops hmrc_take_test_slot and puts the six-event rule back on
-- hmrc_audit_log.event.
--
-- !!! The audit log is append-only, so test_call / test_result rows written meanwhile can't and won't be deleted.
-- !!! With such rows the rollback REFUSES unless   SET LOCAL app.hmrc_p1_p2_force = 'on';   in which case the old rule
-- !!! comes back as NOT VALID (it checks new rows; the history stays as it is). Undeploy hmrc-test-call first.
-- =====================================================================================================================
BEGIN;
DO $$
BEGIN
  IF to_regprocedure('public.hmrc_take_test_slot(uuid,uuid,text,text,integer)') IS NULL THEN RAISE EXCEPTION 'HMRC P1 + P2 is not applied'; END IF;
  IF EXISTS (SELECT 1 FROM public.hmrc_audit_log WHERE event IN ('test_call', 'test_result'))
     AND COALESCE(current_setting('app.hmrc_p1_p2_force', true), '') <> 'on' THEN
    RAISE EXCEPTION 'The HMRC audit log has % test-call row(s), which stay (append-only). To roll back anyway: SET LOCAL app.hmrc_p1_p2_force = ''on'' (the old event rule then comes back as NOT VALID).',
      (SELECT count(*) FROM public.hmrc_audit_log WHERE event IN ('test_call', 'test_result'));
  END IF;
END $$;
DROP FUNCTION public.hmrc_take_test_slot(uuid, uuid, text, text, integer);
ALTER TABLE public.hmrc_audit_log DROP CONSTRAINT hal_event;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.hmrc_audit_log WHERE event IN ('test_call', 'test_result')) THEN
    ALTER TABLE public.hmrc_audit_log ADD CONSTRAINT hal_event CHECK (event IN ('connect_started', 'connected', 'refreshed', 'refresh_failed', 'disconnected', 'refused')) NOT VALID;
  ELSE
    ALTER TABLE public.hmrc_audit_log ADD CONSTRAINT hal_event CHECK (event IN ('connect_started', 'connected', 'refreshed', 'refresh_failed', 'disconnected', 'refused'));
  END IF;
END $$;
COMMIT;
