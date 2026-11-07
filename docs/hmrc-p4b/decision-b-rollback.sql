-- HMRC P4b, owner decision option B: undo (one transaction). Removes the summary function only.
BEGIN;
DO $$ BEGIN
  IF to_regprocedure('public.vat_company_records_summary(uuid,date,date)') IS NULL THEN RAISE EXCEPTION 'option B is not applied'; END IF;
END $$;
DROP FUNCTION public.vat_company_records_summary(uuid, date, date);
COMMIT;
