-- Update profiles RLS policy to allow viewing public profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Allow users to view their own profile and other public profiles
CREATE POLICY "Users can view public profiles" ON public.profiles
FOR SELECT USING (
  auth.uid() = id OR is_public = true
);