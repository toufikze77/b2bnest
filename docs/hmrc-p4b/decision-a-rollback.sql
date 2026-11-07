-- HMRC P4b, owner decision option A: undo (one transaction). Removes the three read policies only.
BEGIN;
DO $$ BEGIN
  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND policyname = 'Company owners and admins can read company records') <> 3 THEN RAISE EXCEPTION 'option A is not applied'; END IF;
END $$;
DROP POLICY "Company owners and admins can read company records" ON public.invoices;
DROP POLICY "Company owners and admins can read company records" ON public.expenses;
DROP POLICY "Company owners and admins can read company records" ON public.bills;
COMMIT;
