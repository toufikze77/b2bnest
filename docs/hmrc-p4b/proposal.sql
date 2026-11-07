-- =====================================================================================================================
-- HMRC P4b: link invoices, expenses and bills to a company. PREPARED, NOT APPLIED. Nothing is filed; HMRC untouched.
-- ORDER (docs/hmrc-p4b/README.md): 1 the owner reviews this; 2 it is applied after review; 3 the frontend is published
-- (it also works before this is applied).
--
-- What it adds (one transaction; any check failing changes nothing). Additive: no column dropped or retyped, no RLS
-- policy added, changed or dropped, no row assigned or back-filled. Every existing row keeps organization_id NULL
-- ("no company yet"); only the person who owns a record can assign it, from the app, one confirmed company at a time.
--   invoices, expenses, bills: organization_id uuid NULL REFERENCES public.organizations(id) ON DELETE RESTRICT (a
--     company that still has finance records can't be deleted: they are accounting records, never cascaded away), and
--     an index on organization_id.
--   Trigger a1_finance_company_check (public.finance_company_check, SECURITY INVOKER, search_path ''), BEFORE INSERT OR
--     UPDATE OF organization_id, vat_status, after the demo guard (a0_…):
--       * a company may only be set to one where the signed-in person is an active member
--         (public.user_is_organization_member, already in production). Checked on INSERT and whenever it changes.
--         A record that keeps its company is not re-checked (someone who left a company can still fix their own row).
--       * a record that BECOMES VAT-recorded (inserted as 'recorded', or changed from 'not_recorded' to 'recorded') must
--         have a company. Rows already 'recorded' with no company stay valid and can be edited; P5 leaves them out.
--       * a 'recorded' record can't have its company removed (set back to NULL).
--       * server writes (role service_role, or the database owner postgres / supabase_admin) are not checked.
--   public.vat_records_needing_attention(p_organization_id uuid DEFAULT NULL) replaces the no-argument function:
--     the old call (no argument) returns the same counts as before with scope 'all'; with a company it returns the
--     signed-in person's records of that company (scope 'company') and their records with no company ('unassigned').
--     SECURITY INVOKER as before, and always limited to user_id = auth.uid(), so it stays "my own records" even if the
--     owner later grants company read access (docs/hmrc-p4b/decision-*.sql).
-- NOT in this file (owner decision, docs/hmrc-p4b/README.md): read access for a company's owners and admins to records
-- other members tagged to the company. Members' own rows stay private to them, as now.
-- Not changed: quotes, outgoings, bank_transactions, any hmrc_* table or function, any policy, the P4 VAT checks.
--
-- Production facts this was written against (read-only, 7 Nov 2026, after HMRC P4 was applied): column signatures
-- (md5) invoices b9611f63d017a039efcfc0f172d7e700, expenses 3302704976e5a0a8c87a6bf37648b2df,
-- bills 143f9368d5f8fb372d9ca73cbf8cdac8, organization_members 9196ca32cb304ecfdc12de1d4a249001; the triggers and
-- policies listed below; md5(prosrc) vat_records_needing_attention f2bf9dda2c44d67442fe86fa35d98321,
-- vat_check_invoice_lines 27e4db86b0ef6df6bc3c2ca8f9577d4d, user_is_organization_member 1fb55538d44b2451875f8baf1b6e4388,
-- demo_readonly_guard 087b5fe2695b95b8ba2ba6eb195ba995. Anything else: refused.
-- Rollback: docs/hmrc-p4b/rollback.sql. Tests: docs/hmrc-p4b/run-test.sh.
-- =====================================================================================================================
BEGIN;

DO $$
DECLARE r record; v text;
BEGIN
  IF to_regprocedure('public.finance_company_check()') IS NOT NULL OR to_regprocedure('public.vat_records_needing_attention(uuid)') IS NOT NULL
     OR EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('invoices', 'expenses', 'bills') AND column_name = 'organization_id') THEN
    RAISE EXCEPTION 'HMRC P4b already exists (applied twice?)';
  END IF;
  IF to_regprocedure('public.vat_records_needing_attention()') IS NULL THEN
    RAISE EXCEPTION 'HMRC P4 is not applied: apply docs/hmrc-p4/proposal.sql first';
  END IF;
  FOR r IN SELECT * FROM (VALUES ('invoices', 'b9611f63d017a039efcfc0f172d7e700'), ('expenses', '3302704976e5a0a8c87a6bf37648b2df'),
                                 ('bills', '143f9368d5f8fb372d9ca73cbf8cdac8'), ('organization_members', '9196ca32cb304ecfdc12de1d4a249001')) x(t, h) LOOP
    SELECT md5(string_agg(a.attname || ':' || format_type(a.atttypid, a.atttypmod) || ':' || coalesce(pg_get_expr(d.adbin, d.adrelid), '') || ':' || a.attnotnull::text, ',' ORDER BY a.attnum))
      INTO v FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
     WHERE a.attrelid = format('public.%I', r.t)::regclass AND a.attnum > 0 AND NOT a.attisdropped;
    IF v IS DISTINCT FROM r.h THEN RAISE EXCEPTION 'public.% columns differ from production as read on 7 Nov 2026', r.t; END IF;
  END LOOP;
  SELECT string_agg(c.relname || '.' || t.tgname || '>' || t.tgfoid::regprocedure::text, ',' ORDER BY c.relname, t.tgname) INTO v
    FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid WHERE c.oid IN ('public.invoices'::regclass, 'public.expenses'::regclass, 'public.bills'::regclass) AND NOT t.tgisinternal;
  IF v IS DISTINCT FROM 'bills.a0_demo_readonly_guard>demo_readonly_guard(),bills.update_bills_updated_at>update_bills_updated_at(),expenses.a0_demo_readonly_guard>demo_readonly_guard(),expenses.update_expenses_updated_at>handle_updated_at(),invoices.a0_demo_readonly_guard>demo_readonly_guard(),invoices.invoices_notify_paid>notify_invoice_paid(),invoices.update_invoices_updated_at>handle_updated_at(),invoices.vat_invoice_lines_check>vat_check_invoice_lines()' THEN
    RAISE EXCEPTION 'The triggers on invoices, expenses and bills differ from production: %', v;
  END IF;
  SELECT string_agg(tablename || '.' || policyname || ':' || cmd, ',' ORDER BY tablename, policyname) INTO v FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('invoices', 'expenses', 'bills');
  IF v IS DISTINCT FROM 'bills.Users can create their own bills:INSERT,bills.Users can delete their own bills:DELETE,bills.Users can update their own bills:UPDATE,bills.Users can view their own bills:SELECT,bills.require_aal2_if_enrolled:ALL,expenses.Users can manage their own expenses:ALL,expenses.require_aal2_if_enrolled:ALL,invoices.Users can create their own invoices:INSERT,invoices.Users can delete their own invoices:DELETE,invoices.Users can update their own invoices:UPDATE,invoices.Users can view their own invoices:SELECT,invoices.require_aal2_if_enrolled:ALL' THEN
    RAISE EXCEPTION 'The policies on invoices, expenses and bills differ from production: %', v;
  END IF;
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.vat_records_needing_attention()')) IS DISTINCT FROM 'f2bf9dda2c44d67442fe86fa35d98321'
     OR (SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.vat_check_invoice_lines()')) IS DISTINCT FROM '27e4db86b0ef6df6bc3c2ca8f9577d4d'
     OR (SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.user_is_organization_member(uuid,uuid)')) IS DISTINCT FROM '1fb55538d44b2451875f8baf1b6e4388'
     OR (SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.demo_readonly_guard()')) IS DISTINCT FROM '087b5fe2695b95b8ba2ba6eb195ba995' THEN
    RAISE EXCEPTION 'vat_records_needing_attention(), vat_check_invoice_lines(), user_is_organization_member() or demo_readonly_guard() differs from production';
  END IF;
END $$;

-- 1. The company column, nullable, no default: existing rows stay NULL ("no company yet").
ALTER TABLE public.invoices ADD COLUMN organization_id uuid CONSTRAINT invoices_organization_id_fkey REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.expenses ADD COLUMN organization_id uuid CONSTRAINT expenses_organization_id_fkey REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.bills ADD COLUMN organization_id uuid CONSTRAINT bills_organization_id_fkey REFERENCES public.organizations(id) ON DELETE RESTRICT;
CREATE INDEX idx_invoices_organization_id ON public.invoices (organization_id);
CREATE INDEX idx_expenses_organization_id ON public.expenses (organization_id);
CREATE INDEX idx_bills_organization_id ON public.bills (organization_id);

-- 2. Only a company you belong to; a record that becomes VAT-recorded needs one; a recorded record keeps it.
CREATE FUNCTION public.finance_company_check()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE v_changed boolean; v_becomes_recorded boolean;
BEGIN
  -- Server writes (service_role, or the database owner) are not checked. SECURITY INVOKER: current_user is the caller.
  IF current_user IN ('service_role', 'postgres', 'supabase_admin') OR coalesce(auth.jwt() ->> 'role', '') = 'service_role' THEN RETURN NEW; END IF;
  v_changed := TG_OP = 'INSERT' OR NEW.organization_id IS DISTINCT FROM OLD.organization_id;
  IF v_changed AND NEW.organization_id IS NOT NULL
     AND (auth.uid() IS NULL OR NOT public.user_is_organization_member(NEW.organization_id, auth.uid())) THEN
    RAISE EXCEPTION 'FINANCE_COMPANY_NOT_MEMBER: you can only link a record to a company you are an active member of' USING ERRCODE = '42501';
  END IF;
  v_becomes_recorded := NEW.vat_status = 'recorded' AND (TG_OP = 'INSERT' OR OLD.vat_status IS DISTINCT FROM 'recorded');
  IF v_becomes_recorded AND NEW.organization_id IS NULL THEN
    RAISE EXCEPTION 'FINANCE_COMPANY_REQUIRED: choose the company before recording this record''s VAT' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.vat_status = 'recorded' AND OLD.organization_id IS NOT NULL AND NEW.organization_id IS NULL THEN
    RAISE EXCEPTION 'FINANCE_COMPANY_REQUIRED: a record with VAT recorded keeps its company' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.finance_company_check() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER a1_finance_company_check BEFORE INSERT OR UPDATE OF organization_id, vat_status ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.finance_company_check();
CREATE TRIGGER a1_finance_company_check BEFORE INSERT OR UPDATE OF organization_id, vat_status ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.finance_company_check();
CREATE TRIGGER a1_finance_company_check BEFORE INSERT OR UPDATE OF organization_id, vat_status ON public.bills FOR EACH ROW EXECUTE FUNCTION public.finance_company_check();

-- 3. The attention counts gain an optional company. No argument: the same counts as before (scope 'all').
DROP FUNCTION public.vat_records_needing_attention();
CREATE FUNCTION public.vat_records_needing_attention(p_organization_id uuid DEFAULT NULL)
 RETURNS TABLE(record_type text, needing bigint, scope text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  WITH mine AS (
    SELECT 'invoices'::text AS record_type, i.organization_id FROM public.invoices i
     WHERE i.user_id = (SELECT auth.uid()) AND i.vat_status = 'not_recorded' AND coalesce(i.status, '') <> 'draft'
    UNION ALL
    SELECT 'expenses'::text, e.organization_id FROM public.expenses e WHERE e.user_id = (SELECT auth.uid()) AND e.vat_status = 'not_recorded'
    UNION ALL
    SELECT 'bills'::text, b.organization_id FROM public.bills b WHERE b.user_id = (SELECT auth.uid()) AND b.vat_status = 'not_recorded' AND b.status <> 'cancelled'
  ), scopes AS (
    SELECT s.scope FROM (VALUES ('all'), ('company'), ('unassigned')) s(scope)
     WHERE (p_organization_id IS NULL AND s.scope = 'all') OR (p_organization_id IS NOT NULL AND s.scope <> 'all')
  ), kinds AS (SELECT k.record_type, k.ord FROM (VALUES ('invoices', 1), ('expenses', 2), ('bills', 3)) k(record_type, ord))
  SELECT k.record_type, (SELECT count(*) FROM mine m WHERE m.record_type = k.record_type AND (s.scope = 'all'
           OR (s.scope = 'company' AND m.organization_id = p_organization_id) OR (s.scope = 'unassigned' AND m.organization_id IS NULL))), s.scope
    FROM scopes s CROSS JOIN kinds k ORDER BY s.scope, k.ord;
$function$;
REVOKE ALL ON FUNCTION public.vat_records_needing_attention(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vat_records_needing_attention(uuid) TO authenticated, service_role;

DO $$
BEGIN
  IF (SELECT prosecdef FROM pg_proc WHERE oid = 'public.vat_records_needing_attention(uuid)'::regprocedure)
     OR (SELECT prosecdef FROM pg_proc WHERE oid = 'public.finance_company_check()'::regprocedure)
     OR has_function_privilege('anon', 'public.vat_records_needing_attention(uuid)', 'EXECUTE')
     OR (SELECT count(*) FROM pg_trigger WHERE tgname = 'a0_demo_readonly_guard' AND tgrelid IN ('public.invoices'::regclass, 'public.expenses'::regclass, 'public.bills'::regclass)) <> 3
     OR (SELECT count(*) FROM pg_trigger WHERE tgname = 'a1_finance_company_check' AND tgrelid IN ('public.invoices'::regclass, 'public.expenses'::regclass, 'public.bills'::regclass)) <> 3
     OR (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('invoices', 'expenses', 'bills')) <> 12
     OR EXISTS (SELECT 1 FROM public.invoices WHERE organization_id IS NOT NULL) OR EXISTS (SELECT 1 FROM public.expenses WHERE organization_id IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.bills WHERE organization_id IS NOT NULL) THEN
    RAISE EXCEPTION 'functions, triggers, policies or rows are not as intended';
  END IF;
END $$;

COMMIT;
