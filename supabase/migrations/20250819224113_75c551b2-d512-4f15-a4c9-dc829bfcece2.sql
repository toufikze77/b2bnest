-- Drop the existing advertisements_public view if it exists
DROP VIEW IF EXISTS public.advertisements_public;

-- Recreate the view without SECURITY DEFINER (uses SECURITY INVOKER by default)
-- This ensures the view uses the permissions of the querying user, not the view creator
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

-- Add comment explaining the security approach
COMMENT ON VIEW public.advertisements_public IS 'Public view of active advertisements. Uses SECURITY INVOKER to enforce RLS policies of the querying user.';