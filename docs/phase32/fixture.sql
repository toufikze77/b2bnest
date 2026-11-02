-- Phase 32 test fixture (DISPOSABLE local Postgres only). Runs after the shim and the Phase 35, 36, 37 and 31 fixtures
-- (docs/phase32/run-test.sh): they give mfa_ok, require_aal2_if_enrolled, the guard log, organisations, organisation
-- members, _access_state_for and user_is_organization_admin / member verbatim from production.
-- Adds the Rota tables exactly as production (migration 20260624145625, read back 2 Nov 2026): columns, FKs, indexes,
-- triggers, RLS, policies and grants.
CREATE OR REPLACE FUNCTION public.handle_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE TABLE public.rota_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text,
  job_title text,
  color text DEFAULT '#6366f1',
  pay_rate_pence integer DEFAULT 0,
  contracted_hours numeric(5,2) DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rota_employees_org_idx ON public.rota_employees(organization_id);
ALTER TABLE public.rota_employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rota_employees_select_org_members" ON public.rota_employees FOR SELECT TO authenticated
  USING (public.user_is_organization_member(organization_id, auth.uid()));
CREATE POLICY "rota_employees_insert_admins" ON public.rota_employees FOR INSERT TO authenticated
  WITH CHECK (public.user_is_organization_admin(organization_id, auth.uid()));
CREATE POLICY "rota_employees_update_admins" ON public.rota_employees FOR UPDATE TO authenticated
  USING (public.user_is_organization_admin(organization_id, auth.uid())) WITH CHECK (public.user_is_organization_admin(organization_id, auth.uid()));
CREATE POLICY "rota_employees_delete_admins" ON public.rota_employees FOR DELETE TO authenticated
  USING (public.user_is_organization_admin(organization_id, auth.uid()));
CREATE POLICY require_aal2_if_enrolled ON public.rota_employees AS RESTRICTIVE FOR ALL TO authenticated
  USING (( SELECT public.mfa_ok() AS mfa_ok)) WITH CHECK (( SELECT public.mfa_ok() AS mfa_ok));
CREATE TRIGGER rota_employees_set_updated_at BEFORE UPDATE ON public.rota_employees FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE public.rota_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.rota_employees(id) ON DELETE CASCADE,
  shift_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  break_minutes integer NOT NULL DEFAULT 0,
  role text,
  location text,
  notes text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rota_shifts_org_date_idx ON public.rota_shifts(organization_id, shift_date);
CREATE INDEX rota_shifts_employee_idx ON public.rota_shifts(employee_id);
ALTER TABLE public.rota_shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rota_shifts_select_org_members" ON public.rota_shifts FOR SELECT TO authenticated
  USING (public.user_is_organization_member(organization_id, auth.uid()));
CREATE POLICY "rota_shifts_insert_admins" ON public.rota_shifts FOR INSERT TO authenticated
  WITH CHECK (public.user_is_organization_admin(organization_id, auth.uid()));
CREATE POLICY "rota_shifts_update_admins" ON public.rota_shifts FOR UPDATE TO authenticated
  USING (public.user_is_organization_admin(organization_id, auth.uid())) WITH CHECK (public.user_is_organization_admin(organization_id, auth.uid()));
CREATE POLICY "rota_shifts_delete_admins" ON public.rota_shifts FOR DELETE TO authenticated
  USING (public.user_is_organization_admin(organization_id, auth.uid()));
CREATE POLICY require_aal2_if_enrolled ON public.rota_shifts AS RESTRICTIVE FOR ALL TO authenticated
  USING (( SELECT public.mfa_ok() AS mfa_ok)) WITH CHECK (( SELECT public.mfa_ok() AS mfa_ok));
CREATE TRIGGER rota_shifts_set_updated_at BEFORE UPDATE ON public.rota_shifts FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Production grants: anon SELECT (+ MAINTAIN on PG 17; this local server is 16), authenticated and service_role all.
REVOKE ALL ON public.rota_employees, public.rota_shifts FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.rota_employees, public.rota_shifts TO anon;
GRANT ALL ON public.rota_employees, public.rota_shifts TO authenticated, service_role;
GRANT SELECT, UPDATE ON public.organizations TO authenticated;
GRANT SELECT ON public.organization_members, public.profiles TO authenticated;
