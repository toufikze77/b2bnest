DROP POLICY IF EXISTS "anyone can read settings" ON public.platform_settings;
CREATE POLICY "super admins read settings" ON public.platform_settings FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "anyone can view tools" ON public.platform_tools;
CREATE POLICY "super admins read tools" ON public.platform_tools FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));