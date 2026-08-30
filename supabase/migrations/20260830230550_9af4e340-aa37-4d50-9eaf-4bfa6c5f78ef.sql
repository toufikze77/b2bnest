CREATE TABLE public.template_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  is_custom boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'published',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT template_catalog_status_check CHECK (status IN ('published','draft','archived'))
);

GRANT SELECT ON public.template_catalog TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.template_catalog TO authenticated;
GRANT ALL ON public.template_catalog TO service_role;

ALTER TABLE public.template_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published templates are readable by everyone"
ON public.template_catalog FOR SELECT
USING (status = 'published');

CREATE POLICY "Super admins can read all templates"
ON public.template_catalog FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can insert templates"
ON public.template_catalog FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update templates"
ON public.template_catalog FOR UPDATE TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete templates"
ON public.template_catalog FOR DELETE TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE TRIGGER template_catalog_set_updated_at
BEFORE UPDATE ON public.template_catalog
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE public.template_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_slug text NOT NULL,
  event_type text NOT NULL,
  user_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT template_events_type_check CHECK (event_type IN ('view','preview','use_click','created'))
);

CREATE INDEX template_events_slug_idx ON public.template_events (template_slug, event_type);
CREATE INDEX template_events_created_at_idx ON public.template_events (created_at DESC);

GRANT INSERT ON public.template_events TO anon;
GRANT SELECT, INSERT ON public.template_events TO authenticated;
GRANT ALL ON public.template_events TO service_role;

ALTER TABLE public.template_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record their own template activity"
ON public.template_events FOR INSERT
WITH CHECK (user_id IS NOT DISTINCT FROM auth.uid());

CREATE POLICY "Super admins can read template activity"
ON public.template_events FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.template_usage_counts()
RETURNS TABLE (slug text, views bigint, previews bigint, use_clicks bigint, created_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT
    e.template_slug AS slug,
    count(*) FILTER (WHERE e.event_type = 'view')::bigint,
    count(*) FILTER (WHERE e.event_type = 'preview')::bigint,
    count(*) FILTER (WHERE e.event_type = 'use_click')::bigint,
    count(*) FILTER (WHERE e.event_type = 'created')::bigint
  FROM public.template_events e
  GROUP BY e.template_slug
$$;

GRANT EXECUTE ON FUNCTION public.template_usage_counts() TO anon, authenticated;