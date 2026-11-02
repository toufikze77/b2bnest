-- Phase 36 rollback (one transaction): removes public.admin_overview_series and its Phase 25 guard log row. Nothing else
-- was changed by Phase 36. Publish the previous frontend first, or its four sections show "Not available".
BEGIN;
DO $$
BEGIN
  IF to_regprocedure('public.admin_overview_series(text,integer)') IS NULL THEN RAISE EXCEPTION 'Phase 36 is not applied'; END IF;
END $$;
DROP FUNCTION public.admin_overview_series(text, integer);
DELETE FROM public.phase25_mfa_guard_log WHERE fn = 'public.admin_overview_series(text,integer)';
COMMIT;
