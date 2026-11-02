-- Phase 31 test fixture (DISPOSABLE local Postgres only). Runs after the shim and the Phase 35, 36 and 37 fixtures
-- (docs/phase31/run-test.sh), which give mfa_ok / require_aal2_if_enrolled / is_super_admin / phase25_mfa_guard_log,
-- organizations, organization_members and _access_state_for exactly as production.
-- Adds what Phase 31 touches, with production's columns, policies, trigger and grants (read 2 Nov 2026).

-- public.projects (production columns; the policies are production's).
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, name text NOT NULL, description text, color text NOT NULL DEFAULT 'blue',
  progress integer NOT NULL DEFAULT 0, members jsonb, deadline date, budget numeric, client text, status text NOT NULL DEFAULT 'active',
  custom_columns jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), stage text, priority text,
  estimated_hours integer, actual_hours integer, custom_fields jsonb, organization_id uuid, deleted_at timestamptz, archived_at timestamptz
);
CREATE TABLE public.project_members (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid, user_id uuid, role text, created_at timestamptz DEFAULT now());

-- Production helper functions, verbatim.
CREATE OR REPLACE FUNCTION public.user_is_organization_member(org_id uuid, check_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 
    FROM public.organization_members om
    WHERE om.organization_id = org_id 
      AND om.user_id = check_user_id 
      AND om.is_active = true
  );
$function$;
CREATE OR REPLACE FUNCTION public.user_is_organization_admin(org_id uuid, check_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 
    FROM public.organization_members om
    WHERE om.organization_id = org_id 
      AND om.user_id = check_user_id 
      AND om.role IN ('owner', 'admin')
      AND om.is_active = true
  );
$function$;
CREATE OR REPLACE FUNCTION public.user_is_organization_owner(org_id uuid, check_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = org_id AND om.user_id = check_user_id AND om.role = 'owner' AND om.is_active = true);
$function$;
CREATE OR REPLACE FUNCTION public.user_can_access_project(project_id uuid, check_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 
    FROM public.projects p
    LEFT JOIN public.organization_members om ON p.organization_id = om.organization_id
    WHERE p.id = project_id 
      AND (p.user_id = check_user_id OR (om.user_id = check_user_id AND om.is_active = true))
  );
$function$;
CREATE OR REPLACE FUNCTION public.is_project_member(_project_id uuid, _user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members
    WHERE project_id = _project_id
      AND user_id = _user_id
  )
$function$;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY projects_org_select ON public.projects FOR SELECT TO authenticated
  USING (((organization_id IS NOT NULL) AND public.user_is_organization_member(organization_id, auth.uid())) OR ((organization_id IS NULL) AND (user_id = auth.uid())) OR public.is_project_member(id, auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY projects_org_insert ON public.projects FOR INSERT TO authenticated
  WITH CHECK ((user_id = auth.uid()) AND ((organization_id IS NULL) OR public.user_is_organization_member(organization_id, auth.uid())));
CREATE POLICY require_aal2_if_enrolled ON public.projects AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));

-- public.project_time_entries exactly as production (2 Nov 2026): columns, FK, indexes, trigger, RLS, policies, grants.
CREATE TABLE public.project_time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  task_name text NOT NULL,
  description text,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  duration_minutes integer NOT NULL DEFAULT 0,
  is_billable boolean NOT NULL DEFAULT true,
  hourly_rate numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_project_time_entries_project_id ON public.project_time_entries USING btree (project_id);
CREATE INDEX idx_project_time_entries_user_id ON public.project_time_entries USING btree (user_id);
CREATE INDEX idx_project_time_entries_created_at ON public.project_time_entries USING btree (created_at DESC);
CREATE OR REPLACE FUNCTION public.update_project_time_entries_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;
CREATE TRIGGER update_project_time_entries_updated_at BEFORE UPDATE ON public.project_time_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_project_time_entries_updated_at();
ALTER TABLE public.project_time_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project owners can manage their time entries" ON public.project_time_entries FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1 FROM public.projects p WHERE ((p.id = project_time_entries.project_id) AND (p.user_id = auth.uid())))))
  WITH CHECK ((EXISTS ( SELECT 1 FROM public.projects p WHERE ((p.id = project_time_entries.project_id) AND (p.user_id = auth.uid())))));
CREATE POLICY "Users can manage time entries in their organization projects" ON public.project_time_entries FOR ALL TO public
  USING ((EXISTS ( SELECT 1 FROM (public.projects p JOIN public.organization_members om ON ((p.organization_id = om.organization_id)))
  WHERE ((p.id = project_time_entries.project_id) AND (om.user_id = auth.uid()) AND (om.is_active = true)))));
CREATE POLICY "Users can view their own time entries" ON public.project_time_entries FOR SELECT TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY require_aal2_if_enrolled ON public.project_time_entries AS RESTRICTIVE FOR ALL TO authenticated
  USING (( SELECT public.mfa_ok() AS mfa_ok)) WITH CHECK (( SELECT public.mfa_ok() AS mfa_ok));
-- Production grants: anon SELECT (+ MAINTAIN on PG 17; this local server is 16), authenticated and service_role all.
REVOKE ALL ON public.project_time_entries FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.project_time_entries TO anon;
GRANT ALL ON public.project_time_entries TO authenticated, service_role;
GRANT ALL ON public.projects, public.project_members TO authenticated, service_role;
