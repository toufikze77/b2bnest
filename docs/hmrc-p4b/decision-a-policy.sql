-- =====================================================================================================================
-- HMRC P4b, OWNER DECISION, OPTION A (not recommended, see README). PREPARED, NOT APPLIED, NOT part of proposal.sql.
-- Apply only if the owner chooses it, after proposal.sql. Undo: decision-a-rollback.sql.
--
-- One extra read-only (SELECT) policy on invoices, expenses and bills: an active OWNER or ADMIN of a company can read
-- every row tagged to that company, whoever wrote it (whole rows: client names, addresses, notes, lines). Rows with no
-- company stay private to their owner. No write policy changes. The restrictive require_aal2_if_enrolled policy still
-- applies (two-step sign-in when the person has it). The app's screens filter by user_id, so they look the same; any
-- query without that filter would start returning other members' rows to owners and admins.
-- =====================================================================================================================
BEGIN;
DO $$ BEGIN
  IF to_regprocedure('public.finance_company_check()') IS NULL THEN RAISE EXCEPTION 'apply docs/hmrc-p4b/proposal.sql first'; END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND policyname = 'Company owners and admins can read company records') THEN RAISE EXCEPTION 'option A is already applied'; END IF;
  IF to_regprocedure('public.vat_company_records_summary(uuid,date,date)') IS NOT NULL THEN RAISE EXCEPTION 'option B is applied: choose one option, not both'; END IF;
END $$;
CREATE POLICY "Company owners and admins can read company records" ON public.invoices AS PERMISSIVE FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND public.user_is_organization_admin(organization_id, (SELECT auth.uid())));
CREATE POLICY "Company owners and admins can read company records" ON public.expenses AS PERMISSIVE FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND public.user_is_organization_admin(organization_id, (SELECT auth.uid())));
CREATE POLICY "Company owners and admins can read company records" ON public.bills AS PERMISSIVE FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND public.user_is_organization_admin(organization_id, (SELECT auth.uid())));
COMMIT;
