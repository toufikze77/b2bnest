-- Fix profiles table RLS policies to prevent unauthorized access to personal data
-- Simple approach: Remove broad public access, keep only user-specific and admin access

-- Drop the problematic policy that allows any authenticated user to view other users' data
DROP POLICY IF EXISTS "Authenticated users can view limited public profile data" ON public.profiles;

-- Ensure users can only view their own complete profiles
CREATE POLICY "Users can view only their own profiles" ON public.profiles
FOR SELECT 
TO authenticated
USING (auth.uid() = id);

-- Allow admins to view all profiles with audit logging
CREATE POLICY "Admins can view all profiles" ON public.profiles
FOR SELECT 
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR 
  public.has_role(auth.uid(), 'owner'::app_role)
);

-- Create audit logging function for sensitive profile access
CREATE OR REPLACE FUNCTION public.audit_profile_access(accessed_user_id uuid, access_type text DEFAULT 'profile_viewed')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Only log if it's not the user viewing their own profile
  IF auth.uid() != accessed_user_id THEN
    INSERT INTO public.audit_logs (
      user_id,
      action,
      resource_type,
      resource_id,
      details,
      ip_address
    )
    VALUES (
      auth.uid(),
      access_type,
      'profile',
      accessed_user_id::text,
      jsonb_build_object(
        'accessed_at', now(),
        'target_user', accessed_user_id
      ),
      inet_client_addr()
    );
  END IF;
END;
$$;