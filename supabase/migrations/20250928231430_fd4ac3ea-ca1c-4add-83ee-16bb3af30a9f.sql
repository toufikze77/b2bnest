-- SECURITY FIX: Remove anonymous access to profile data

-- Drop the problematic policy that allows anonymous users to view profile data
DROP POLICY "Anonymous can view safe public profile fields only" ON public.profiles;