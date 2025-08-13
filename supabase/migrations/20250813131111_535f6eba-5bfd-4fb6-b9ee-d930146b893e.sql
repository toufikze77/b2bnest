-- Fix security definer view issue by recreating without SECURITY DEFINER

-- Drop the problematic view
DROP VIEW IF EXISTS public.advertisements_public;

-- Recreate the view without SECURITY DEFINER (default is SECURITY INVOKER which is safer)
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
  website_url,  -- Keep website URL as it's typically public
  is_service,
  is_active,
  featured_until,
  view_count,
  image_urls,
  created_at,
  updated_at
FROM public.advertisements
WHERE is_active = true;

-- Grant access to the view
GRANT SELECT ON public.advertisements_public TO anon;
GRANT SELECT ON public.advertisements_public TO authenticated;

-- Update the contact info function to use explicit search_path
DROP FUNCTION IF EXISTS public.get_advertisement_contact_info(uuid);
CREATE OR REPLACE FUNCTION public.get_advertisement_contact_info(ad_id uuid)
RETURNS TABLE(contact_email text, contact_phone text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

-- Grant access to the function
GRANT EXECUTE ON FUNCTION public.get_advertisement_contact_info(uuid) TO authenticated;