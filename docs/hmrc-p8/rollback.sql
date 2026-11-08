-- =====================================================================================================================
-- HMRC P8 rollback (one transaction): drops hmrc_take_read_slot and puts the fifteen-event rule back on
-- hmrc_audit_log.event. Undeploy hmrc-vat-return-view, hmrc-vat-liabilities, hmrc-vat-payments and hmrc-vat-penalties
-- first (they then answer "not available yet" anyway, because the slot function is gone).
--
-- !!! The audit log is append-only, so the P8 read rows written meanwhile stay. With such rows the rollback REFUSES
-- !!! unless   SET app.hmrc_p8_force = 'on';   in which case the old rule comes back as NOT VALID (it checks new rows;
-- !!! the history stays as it is).
-- =====================================================================================================================
BEGIN;
DO $$
BEGIN
  IF to_regprocedure('public.hmrc_take_read_slot(uuid,uuid,text,text,integer)') IS NULL THEN RAISE EXCEPTION 'HMRC P8 is not applied'; END IF;
  IF EXISTS (SELECT 1 FROM public.hmrc_audit_log WHERE event LIKE 'vat\_return\_view\_%' OR event LIKE 'vat\_liabilities\_%' OR event LIKE 'vat\_payments\_%' OR event LIKE 'vat\_penalties\_%')
     AND COALESCE(current_setting('app.hmrc_p8_force', true), '') <> 'on' THEN
    RAISE EXCEPTION 'The HMRC audit log has % HMRC P8 read row(s), which stay (append-only). To roll back anyway: SET app.hmrc_p8_force = ''on'' (the old event rule then comes back as NOT VALID).',
      (SELECT count(*) FROM public.hmrc_audit_log WHERE event LIKE 'vat\_return\_view\_%' OR event LIKE 'vat\_liabilities\_%' OR event LIKE 'vat\_payments\_%' OR event LIKE 'vat\_penalties\_%');
  END IF;
END $$;
DROP FUNCTION public.hmrc_take_read_slot(uuid, uuid, text, text, integer);
ALTER TABLE public.hmrc_audit_log DROP CONSTRAINT hal_event;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.hmrc_audit_log WHERE event LIKE 'vat\_return\_view\_%' OR event LIKE 'vat\_liabilities\_%' OR event LIKE 'vat\_payments\_%' OR event LIKE 'vat\_penalties\_%') THEN
    ALTER TABLE public.hmrc_audit_log ADD CONSTRAINT hal_event CHECK (event IN ('connect_started', 'connected', 'refreshed', 'refresh_failed', 'disconnected', 'refused',
      'test_call', 'test_result', 'obligations_call', 'obligations_result',
      'vat_submit_start', 'vat_submit_result', 'vat_submit_unknown', 'vat_submit_check', 'fraud_validate')) NOT VALID;
  ELSE
    ALTER TABLE public.hmrc_audit_log ADD CONSTRAINT hal_event CHECK (event IN ('connect_started', 'connected', 'refreshed', 'refresh_failed', 'disconnected', 'refused',
      'test_call', 'test_result', 'obligations_call', 'obligations_result',
      'vat_submit_start', 'vat_submit_result', 'vat_submit_unknown', 'vat_submit_check', 'fraud_validate'));
  END IF;
END $$;
COMMIT;
