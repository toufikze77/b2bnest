-- =====================================================================================================================
-- HMRC P3 rollback (one transaction): drops hmrc_take_obligations_slot and puts the eight-event rule back on
-- hmrc_audit_log.event. Undeploy hmrc-vat-obligations first.
--
-- !!! The audit log is append-only, so obligations_call / obligations_result rows written meanwhile stay. With such rows
-- !!! the rollback REFUSES unless   SET app.hmrc_p3_force = 'on';   in which case the old rule comes back as NOT VALID
-- !!! (it checks new rows; the history stays as it is).
-- =====================================================================================================================
BEGIN;
DO $$
BEGIN
  IF to_regprocedure('public.hmrc_take_obligations_slot(uuid,uuid,text,text,integer)') IS NULL THEN RAISE EXCEPTION 'HMRC P3 is not applied'; END IF;
  IF EXISTS (SELECT 1 FROM public.hmrc_audit_log WHERE event IN ('obligations_call', 'obligations_result'))
     AND COALESCE(current_setting('app.hmrc_p3_force', true), '') <> 'on' THEN
    RAISE EXCEPTION 'The HMRC audit log has % obligations row(s), which stay (append-only). To roll back anyway: SET app.hmrc_p3_force = ''on'' (the old event rule then comes back as NOT VALID).',
      (SELECT count(*) FROM public.hmrc_audit_log WHERE event IN ('obligations_call', 'obligations_result'));
  END IF;
END $$;
DROP FUNCTION public.hmrc_take_obligations_slot(uuid, uuid, text, text, integer);
ALTER TABLE public.hmrc_audit_log DROP CONSTRAINT hal_event;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.hmrc_audit_log WHERE event IN ('obligations_call', 'obligations_result')) THEN
    ALTER TABLE public.hmrc_audit_log ADD CONSTRAINT hal_event CHECK (event IN ('connect_started', 'connected', 'refreshed', 'refresh_failed', 'disconnected', 'refused',
                                                                              'test_call', 'test_result')) NOT VALID;
  ELSE
    ALTER TABLE public.hmrc_audit_log ADD CONSTRAINT hal_event CHECK (event IN ('connect_started', 'connected', 'refreshed', 'refresh_failed', 'disconnected', 'refused',
                                                                              'test_call', 'test_result'));
  END IF;
END $$;
COMMIT;
