-- Secure advertisements table: hide contact information from unauthenticated users

-- Create a secure view for public advertisement listings that excludes sensitive contact info
CREATE OR REPLACE VIEW public.advertisements_public AS
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

-- Grant public read access to the view
GRANT SELECT ON public.advertisements_public TO anon;
GRANT SELECT ON public.advertisements_public TO authenticated;

-- Update RLS policies for the main advertisements table
-- Remove the overly permissive public policy
DROP POLICY IF EXISTS "Public can view active advertisements and users can view their own" ON public.advertisements;

-- Create new restrictive policies
-- 1. Users can view their own advertisements (full access including contact info)
CREATE POLICY "Users can view their own advertisements"
ON public.advertisements
FOR SELECT
USING (auth.uid() = user_id);

-- 2. Authenticated users can view advertisements WITH contact info (for legitimate inquiries)
CREATE POLICY "Authenticated users can view advertisements with contact info"
ON public.advertisements
FOR SELECT
USING (is_active = true AND auth.uid() IS NOT NULL);

-- 3. Anonymous users can only view basic advertisement info through the public view
-- (No direct policy needed as they'll use the view)

-- Keep existing policies for INSERT, UPDATE, DELETE
-- (They already properly restrict to users managing their own ads)

-- Create function to safely get contact info (only for authenticated users)
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

-- Grant access to the function
GRANT EXECUTE ON FUNCTION public.get_advertisement_contact_info(uuid) TO authenticated;