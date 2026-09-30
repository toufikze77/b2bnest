REVOKE ALL ON public.template_applications FROM anon;
REVOKE ALL ON public.template_applications FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.template_applications TO authenticated;
GRANT ALL ON public.template_applications TO service_role;