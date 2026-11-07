-- =====================================================================================================================
-- HMRC P4 rollback (one transaction): removes the VAT columns, checks, trigger and functions exactly.
-- !!! Dropping the columns deletes the VAT details people have entered. It REFUSES while any invoice, expense or bill is
-- !!! 'recorded', unless   SET app.hmrc_p4_force = 'on';   Unpublish the P4 frontend first (the app also works without
-- !!! the columns, but would offer VAT fields it can no longer save).
-- =====================================================================================================================
BEGIN;
DO $$
BEGIN
  IF to_regprocedure('public.vat_records_needing_attention()') IS NULL OR to_regprocedure('public.vat_check_invoice_lines()') IS NULL THEN
    RAISE EXCEPTION 'HMRC P4 is not applied';
  END IF;
  IF (EXISTS (SELECT 1 FROM public.invoices WHERE vat_status = 'recorded') OR EXISTS (SELECT 1 FROM public.expenses WHERE vat_status = 'recorded')
      OR EXISTS (SELECT 1 FROM public.bills WHERE vat_status = 'recorded'))
     AND COALESCE(current_setting('app.hmrc_p4_force', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Some invoices, expenses or bills have VAT details recorded; rolling back deletes them. To roll back anyway: SET app.hmrc_p4_force = ''on''.';
  END IF;
END $$;
DROP FUNCTION public.vat_records_needing_attention();
DROP TRIGGER vat_invoice_lines_check ON public.invoices;
DROP FUNCTION public.vat_check_invoice_lines();
ALTER TABLE public.invoices DROP CONSTRAINT invoices_vat_tax_point_check, DROP COLUMN vat_status, DROP COLUMN vat_scheme, DROP COLUMN tax_point_date;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['expenses', 'bills'] LOOP
    EXECUTE format('ALTER TABLE public.%1$I DROP CONSTRAINT %1$s_vat_recorded_check, DROP COLUMN vat_reclaimable, DROP COLUMN tax_point_date, DROP COLUMN vat_scheme, DROP COLUMN vat_status, DROP COLUMN vat_rate, DROP COLUMN vat_treatment, DROP COLUMN vat_amount, DROP COLUMN net_amount', t);
  END LOOP;
END $$;
COMMIT;
