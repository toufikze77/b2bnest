-- Security Fix: Create secure function for accessing user display information
-- This prevents direct access to sensitive profile data while allowing safe collaboration features

-- Create security definer function for safe profile access
-- Returns ONLY non-sensitive display information for team/project member displays
CREATE OR REPLACE FUNCTION public.get_user_display_info(p_user_id uuid)
RETURNS TABLE(
  id uuid,
  display_name text,
  avatar_url text,
  headline text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id,
    display_name,
    avatar_url,
    headline
  FROM public.public_profiles
  WHERE id = p_user_id
  LIMIT 1;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_display_info(uuid) TO authenticated;

-- Add comment explaining the function's purpose
COMMENT ON FUNCTION public.get_user_display_info(uuid) IS 
'Security definer function that returns only non-sensitive user display information (id, display_name, avatar_url, headline). Used for showing user info in team/project member lists without exposing personal data like email, full_name, or private profile fields. This prevents "permission denied" errors while maintaining privacy.';