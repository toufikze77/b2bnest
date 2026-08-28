DROP POLICY IF EXISTS "Authenticated users can view advertisements with contact info" ON public.advertisements;

CREATE OR REPLACE VIEW public.advertisements_public
WITH (security_invoker = off)
AS
SELECT
  a.id,
  a.title,
  a.description,
  a.category,
  a.subcategory,
  a.price,
  a.currency,
  a.website_url,
  a.image_urls,
  a.is_service,
  a.is_active,
  a.featured_until,
  a.view_count,
  a.created_at,
  a.updated_at
FROM public.advertisements a
WHERE a.is_active = true;

GRANT SELECT ON public.advertisements_public TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_advertisement_contact_info(ad_id uuid)
RETURNS TABLE(contact_email text, contact_phone text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  INSERT INTO public.security_audit_logs (user_id, action, details)
  VALUES (auth.uid(), 'advertisement_contact_viewed', jsonb_build_object('advertisement_id', ad_id));

  RETURN QUERY
  SELECT a.contact_email, a.contact_phone
  FROM public.advertisements a
  WHERE a.id = ad_id AND a.is_active = true;
END;
$function$;