CREATE TABLE public.template_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  template_slug text,
  workspace_id uuid,
  primary_project_id uuid,
  kind text,
  status text NOT NULL DEFAULT 'pending',
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, idempotency_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.template_applications TO authenticated;
GRANT ALL ON public.template_applications TO service_role;
ALTER TABLE public.template_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read company template applications" ON public.template_applications
  FOR SELECT TO authenticated USING (public.user_is_organization_member(organization_id, auth.uid()));
CREATE POLICY "Members record own template applications" ON public.template_applications
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() AND public.user_is_organization_member(organization_id, auth.uid()));
CREATE POLICY "Creators update own template applications" ON public.template_applications
  FOR UPDATE TO authenticated USING (created_by = auth.uid() AND public.user_is_organization_member(organization_id, auth.uid()))
  WITH CHECK (created_by = auth.uid() AND public.user_is_organization_member(organization_id, auth.uid()));
CREATE POLICY "Creators delete own template applications" ON public.template_applications
  FOR DELETE TO authenticated USING (created_by = auth.uid());
CREATE TRIGGER template_applications_updated_at BEFORE UPDATE ON public.template_applications
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();