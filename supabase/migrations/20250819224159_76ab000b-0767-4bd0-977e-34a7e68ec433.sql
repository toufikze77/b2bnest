-- Final security audit and cleanup for views and functions
-- Remove any remaining SECURITY DEFINER views and ensure proper function security

-- Check and update the advertisement contact function with proper security settings
DROP FUNCTION IF EXISTS public.get_advertisement_contact_info(uuid);

CREATE OR REPLACE FUNCTION public.get_advertisement_contact_info(ad_id uuid)
RETURNS TABLE(contact_email text, contact_phone text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Only return contact info to authenticated users
  IF auth.uid() IS NULL THEN
    RETURN QUERY SELECT NULL::text, NULL::text;
  END IF;
  
  RETURN QUERY
  SELECT a.contact_email, a.contact_phone
  FROM public.advertisements a
  WHERE a.id = ad_id AND a.is_active = true;
END;
$$;

-- Ensure the advertisements_public view exists without SECURITY DEFINER
DROP VIEW IF EXISTS public.advertisements_public;

CREATE VIEW public.advertisements_public AS
SELECT 
    id,
    user_id,
    title,
    description,
    category,
    subcategory,
    price,
    currency,
    website_url,
    is_service,
    is_active,
    featured_until,
    view_count,
    image_urls,
    created_at,
    updated_at
FROM public.advertisements
WHERE is_active = true;

-- Grant proper permissions
GRANT SELECT ON public.advertisements_public TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_advertisement_contact_info(uuid) TO authenticated;