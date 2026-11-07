-- =====================================================================================================================
-- HMRC P4b rollback (one transaction): removes the company column, the trigger and the new attention function, and puts
-- back the P4 attention function exactly. Roll back an owner-decision file (decision-a-policy.sql or
-- decision-b-function.sql) first, if one was applied: this refuses while either is present.
-- !!! Dropping the column forgets which company each record was assigned to. It REFUSES while any invoice, expense or
-- !!! bill has a company, unless   SET app.hmrc_p4b_force = 'on';   Unpublish the P4b frontend first (the app also works
-- !!! without the column).
-- =====================================================================================================================
BEGIN;
DO $$
BEGIN
  IF to_regprocedure('public.finance_company_check()') IS NULL OR to_regprocedure('public.vat_records_needing_attention(uuid)') IS NULL THEN
    RAISE EXCEPTION 'HMRC P4b is not applied';
  END IF;
  IF to_regprocedure('public.vat_company_records_summary(uuid,date,date)') IS NOT NULL
     OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND policyname = 'Company owners and admins can read company records') THEN
    RAISE EXCEPTION 'An owner-decision file is applied: roll it back first (docs/hmrc-p4b/decision-*.sql, the ROLLBACK part)';
  END IF;
  IF (EXISTS (SELECT 1 FROM public.invoices WHERE organization_id IS NOT NULL) OR EXISTS (SELECT 1 FROM public.expenses WHERE organization_id IS NOT NULL)
      OR EXISTS (SELECT 1 FROM public.bills WHERE organization_id IS NOT NULL))
     AND COALESCE(current_setting('app.hmrc_p4b_force', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Some invoices, expenses or bills are linked to a company; rolling back forgets those links. To roll back anyway: SET app.hmrc_p4b_force = ''on''.';
  END IF;
END $$;
DROP TRIGGER a1_finance_company_check ON public.invoices;
DROP TRIGGER a1_finance_company_check ON public.expenses;
DROP TRIGGER a1_finance_company_check ON public.bills;
DROP FUNCTION public.finance_company_check();
DROP INDEX public.idx_invoices_organization_id, public.idx_expenses_organization_id, public.idx_bills_organization_id;
ALTER TABLE public.invoices DROP COLUMN organization_id;
ALTER TABLE public.expenses DROP COLUMN organization_id;
ALTER TABLE public.bills DROP COLUMN organization_id;
DROP FUNCTION public.vat_records_needing_attention(uuid);
-- The HMRC P4 function, exactly as in production.
CREATE FUNCTION public.vat_records_needing_attention()
 RETURNS TABLE(record_type text, needing bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT 'invoices'::text, count(*) FROM public.invoices WHERE vat_status = 'not_recorded' AND coalesce(status, '') <> 'draft'
  UNION ALL
  SELECT 'expenses'::text, count(*) FROM public.expenses WHERE vat_status = 'not_recorded'
  UNION ALL
  SELECT 'bills'::text, count(*) FROM public.bills WHERE vat_status = 'not_recorded' AND status <> 'cancelled';
$function$;
REVOKE ALL ON FUNCTION public.vat_records_needing_attention() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vat_records_needing_attention() TO authenticated, service_role;
DO $$
BEGIN
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.vat_records_needing_attention()'::regprocedure) IS DISTINCT FROM 'f2bf9dda2c44d67442fe86fa35d98321' THEN
    RAISE EXCEPTION 'the restored vat_records_needing_attention() is not the P4 function';
  END IF;
END $$;
COMMIT;
