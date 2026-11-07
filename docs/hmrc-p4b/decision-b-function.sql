-- =====================================================================================================================
-- HMRC P4b, OWNER DECISION, OPTION B (recommended). PREPARED, NOT APPLIED, and NOT part of proposal.sql.
-- Apply only if the owner chooses it, after proposal.sql. Undo: decision-b-rollback.sql.
--
-- public.vat_company_records_summary(p_organization_id, p_from, p_to): SECURITY DEFINER, search_path ''. It lets an
-- active OWNER or ADMIN of the company (public.user_is_organization_admin) read TOTALS of the company's records written
-- by every member, which a company VAT return needs. It never returns a row, a client name, a note or an amount of a
-- single record. Checks, in order: signed in; two-step sign-in done when the person has it (public.mfa_ok(), the same
-- rule as every finance table); owner or admin of that company; a valid date range. Anything else: an error, no data.
-- What it counts (the P5 rule): vat_status = 'recorded', organization_id = the company, tax point in the range;
-- invoices and bills in GBP only (expenses have no currency column: they are in the account currency); invoices that
-- are drafts or archived and bills that are cancelled are left out. It also says how many were left out, and why.
-- Members' own screens are unchanged: no policy is added, so nobody sees anyone else's records in the app.
-- =====================================================================================================================
BEGIN;
DO $$ BEGIN
  IF to_regprocedure('public.finance_company_check()') IS NULL THEN RAISE EXCEPTION 'apply docs/hmrc-p4b/proposal.sql first'; END IF;
  IF to_regprocedure('public.vat_company_records_summary(uuid,date,date)') IS NOT NULL THEN RAISE EXCEPTION 'option B is already applied'; END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND policyname = 'Company owners and admins can read company records') THEN
    RAISE EXCEPTION 'option A is applied: choose one option, not both';
  END IF;
END $$;

CREATE FUNCTION public.vat_company_records_summary(p_organization_id uuid, p_from date, p_to date)
 RETURNS TABLE(record_type text, included bigint, net numeric, vat numeric, left_out_not_recorded bigint, left_out_not_gbp bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'VAT_SUMMARY_DENIED: sign in first' USING ERRCODE = '42501'; END IF;
  IF NOT public.mfa_ok() THEN RAISE EXCEPTION 'VAT_SUMMARY_DENIED: enter your authenticator code first' USING ERRCODE = '42501'; END IF;
  IF p_organization_id IS NULL OR NOT public.user_is_organization_admin(p_organization_id, auth.uid()) THEN
    RAISE EXCEPTION 'VAT_SUMMARY_DENIED: only an owner or admin of this company can see its VAT totals' USING ERRCODE = '42501';
  END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_to < p_from THEN RAISE EXCEPTION 'VAT_SUMMARY_INVALID: choose a valid period' USING ERRCODE = '22023'; END IF;
  RETURN QUERY
  SELECT 'invoices'::text,
         count(*) FILTER (WHERE i.vat_status = 'recorded' AND upper(coalesce(i.currency, '')) = 'GBP' AND i.tax_point_date BETWEEN p_from AND p_to),
         coalesce(sum(i.subtotal) FILTER (WHERE i.vat_status = 'recorded' AND upper(coalesce(i.currency, '')) = 'GBP' AND i.tax_point_date BETWEEN p_from AND p_to), 0),
         coalesce(sum(i.tax_amount) FILTER (WHERE i.vat_status = 'recorded' AND upper(coalesce(i.currency, '')) = 'GBP' AND i.tax_point_date BETWEEN p_from AND p_to), 0),
         count(*) FILTER (WHERE i.vat_status <> 'recorded'),
         count(*) FILTER (WHERE i.vat_status = 'recorded' AND upper(coalesce(i.currency, '')) <> 'GBP' AND i.tax_point_date BETWEEN p_from AND p_to)
    FROM public.invoices i WHERE i.organization_id = p_organization_id AND coalesce(i.status, '') <> 'draft' AND i.archived_at IS NULL
  UNION ALL
  SELECT 'expenses'::text,
         count(*) FILTER (WHERE e.vat_status = 'recorded' AND e.tax_point_date BETWEEN p_from AND p_to),
         coalesce(sum(e.net_amount) FILTER (WHERE e.vat_status = 'recorded' AND e.tax_point_date BETWEEN p_from AND p_to), 0),
         coalesce(sum(e.vat_amount) FILTER (WHERE e.vat_status = 'recorded' AND e.vat_reclaimable AND e.tax_point_date BETWEEN p_from AND p_to), 0),
         count(*) FILTER (WHERE e.vat_status <> 'recorded'),
         0::bigint
    FROM public.expenses e WHERE e.organization_id = p_organization_id
  UNION ALL
  SELECT 'bills'::text,
         count(*) FILTER (WHERE b.vat_status = 'recorded' AND upper(b.currency) = 'GBP' AND b.tax_point_date BETWEEN p_from AND p_to),
         coalesce(sum(b.net_amount) FILTER (WHERE b.vat_status = 'recorded' AND upper(b.currency) = 'GBP' AND b.tax_point_date BETWEEN p_from AND p_to), 0),
         coalesce(sum(b.vat_amount) FILTER (WHERE b.vat_status = 'recorded' AND b.vat_reclaimable AND upper(b.currency) = 'GBP' AND b.tax_point_date BETWEEN p_from AND p_to), 0),
         count(*) FILTER (WHERE b.vat_status <> 'recorded'),
         count(*) FILTER (WHERE b.vat_status = 'recorded' AND upper(b.currency) <> 'GBP' AND b.tax_point_date BETWEEN p_from AND p_to)
    FROM public.bills b WHERE b.organization_id = p_organization_id AND b.status <> 'cancelled';
END;
$function$;
REVOKE ALL ON FUNCTION public.vat_company_records_summary(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vat_company_records_summary(uuid, date, date) TO authenticated;
COMMIT;
