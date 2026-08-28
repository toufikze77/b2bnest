DROP VIEW IF EXISTS public.advertisements_public;

-- Restore browsing of active listings, but block the contact columns at the privilege level.
CREATE POLICY "Anyone signed in can browse active advertisements"
ON public.advertisements
FOR SELECT
TO authenticated
USING (is_active = true);

REVOKE SELECT ON public.advertisements FROM anon, authenticated;
GRANT SELECT (
  id, user_id, title, description, category, subcategory, price, currency,
  website_url, image_urls, is_service, is_active, featured_until, view_count,
  created_at, updated_at
) ON public.advertisements TO authenticated;
GRANT ALL ON public.advertisements TO service_role;