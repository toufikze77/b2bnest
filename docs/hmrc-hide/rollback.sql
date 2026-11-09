-- =====================================================================================================================
-- HMRC hide switch rollback (one transaction): removes the two functions, the read policy and the setting row.
-- With the row gone, the Edge Functions and the app treat HMRC as HIDDEN for customers (fail closed). To show HMRC to
-- customers again without this SQL, redeploy the previous Edge Functions and front end instead.
-- The admin audit entries written by hmrc_set_customer_access stay (they are the record of who changed it).
-- =====================================================================================================================
BEGIN;
DO $$
BEGIN
  IF to_regprocedure('public.hmrc_set_customer_access(text)') IS NULL THEN RAISE EXCEPTION 'HMRC hide switch is not applied'; END IF;
END $$;
DROP FUNCTION public.hmrc_customer_access_status();
DROP FUNCTION public.hmrc_set_customer_access(text);
DROP POLICY "signed-in people read the HMRC access setting" ON public.platform_settings;
DELETE FROM public.platform_settings WHERE key = 'hmrc_customer_access';
COMMIT;
