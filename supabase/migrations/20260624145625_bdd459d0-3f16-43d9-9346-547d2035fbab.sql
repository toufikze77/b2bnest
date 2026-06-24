
-- ============ rota_employees ============
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rota_employees TO authenticated;
GRANT ALL ON public.rota_employees TO service_role;

ALTER TABLE public.rota_employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rota_employees_select_org_members" ON public.rota_employees
  FOR SELECT TO authenticated
  USING (public.user_is_organization_member(organization_id, auth.uid()));

CREATE POLICY "rota_employees_insert_admins" ON public.rota_employees
  FOR INSERT TO authenticated
  WITH CHECK (public.user_is_organization_admin(organization_id, auth.uid()));

CREATE POLICY "rota_employees_update_admins" ON public.rota_employees
  FOR UPDATE TO authenticated
  USING (public.user_is_organization_admin(organization_id, auth.uid()))
  WITH CHECK (public.user_is_organization_admin(organization_id, auth.uid()));

CREATE POLICY "rota_employees_delete_admins" ON public.rota_employees
  FOR DELETE TO authenticated
  USING (public.user_is_organization_admin(organization_id, auth.uid()));

CREATE TRIGGER rota_employees_set_updated_at
  BEFORE UPDATE ON public.rota_employees
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============ rota_shifts ============
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rota_shifts TO authenticated;
GRANT ALL ON public.rota_shifts TO service_role;

ALTER TABLE public.rota_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rota_shifts_select_org_members" ON public.rota_shifts
  FOR SELECT TO authenticated
  USING (public.user_is_organization_member(organization_id, auth.uid()));

CREATE POLICY "rota_shifts_insert_admins" ON public.rota_shifts
  FOR INSERT TO authenticated
  WITH CHECK (public.user_is_organization_admin(organization_id, auth.uid()));

CREATE POLICY "rota_shifts_update_admins" ON public.rota_shifts
  FOR UPDATE TO authenticated
  USING (public.user_is_organization_admin(organization_id, auth.uid()))
  WITH CHECK (public.user_is_organization_admin(organization_id, auth.uid()));

CREATE POLICY "rota_shifts_delete_admins" ON public.rota_shifts
  FOR DELETE TO authenticated
  USING (public.user_is_organization_admin(organization_id, auth.uid()));

CREATE TRIGGER rota_shifts_set_updated_at
  BEFORE UPDATE ON public.rota_shifts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============ rota_week_publications ============
CREATE TABLE public.rota_week_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  published_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, week_start)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rota_week_publications TO authenticated;
GRANT ALL ON public.rota_week_publications TO service_role;

ALTER TABLE public.rota_week_publications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rota_pub_select_org_members" ON public.rota_week_publications
  FOR SELECT TO authenticated
  USING (public.user_is_organization_member(organization_id, auth.uid()));

CREATE POLICY "rota_pub_insert_admins" ON public.rota_week_publications
  FOR INSERT TO authenticated
  WITH CHECK (public.user_is_organization_admin(organization_id, auth.uid()));

CREATE POLICY "rota_pub_update_admins" ON public.rota_week_publications
  FOR UPDATE TO authenticated
  USING (public.user_is_organization_admin(organization_id, auth.uid()))
  WITH CHECK (public.user_is_organization_admin(organization_id, auth.uid()));

CREATE POLICY "rota_pub_delete_admins" ON public.rota_week_publications
  FOR DELETE TO authenticated
  USING (public.user_is_organization_admin(organization_id, auth.uid()));

CREATE TRIGGER rota_pub_set_updated_at
  BEFORE UPDATE ON public.rota_week_publications
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============ Plan gate function ============
CREATE OR REPLACE FUNCTION public.rota_can_add_employee(p_org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_tier text;
  v_owner uuid;
BEGIN
  -- Must be admin in org
  IF NOT public.user_is_organization_admin(p_org_id, auth.uid()) THEN
    RETURN false;
  END IF;

  -- Find org owner
  SELECT user_id INTO v_owner
  FROM public.organization_members
  WHERE organization_id = p_org_id AND role = 'owner' AND is_active = true
  LIMIT 1;

  -- Check tier on owner's subscriber record
  SELECT lower(coalesce(subscription_tier,'free')) INTO v_tier
  FROM public.subscribers
  WHERE user_id = v_owner
  LIMIT 1;

  IF v_tier IN ('business premium','business_premium','premium','enterprise','business-premium') THEN
    RETURN true;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.rota_employees
  WHERE organization_id = p_org_id AND is_active = true;

  RETURN v_count < 3;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rota_can_add_employee(uuid) TO authenticated;
