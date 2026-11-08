-- HMRC P5 rollback (one transaction): removes the preview function. Nothing else was added, and no data is stored.
BEGIN;
DO $$ BEGIN
  IF to_regprocedure('public.vat_company_return_preview(uuid,date,date)') IS NULL THEN RAISE EXCEPTION 'HMRC P5 is not applied'; END IF;
END $$;
DROP FUNCTION public.vat_company_return_preview(uuid, date, date);
COMMIT;
