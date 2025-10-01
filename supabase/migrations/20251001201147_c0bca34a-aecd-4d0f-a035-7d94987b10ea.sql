-- Fix profiles table RLS policies to protect customer personal data
-- Remove overly permissive admin access to personal information

-- 1. Drop ALL existing policies on profiles table to start clean
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public') 
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.profiles';
    END LOOP;
END $$;

-- 2. Create strict user-only access policies
-- Users can only insert their own profile (during signup)
CREATE POLICY "users_insert_own_profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Users can only view their own profile data
CREATE POLICY "users_view_own_profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Users can only update their own profile
CREATE POLICY "users_update_own_profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Note: No DELETE policy - profiles should not be deleted, only deactivated
-- Note: No admin policies - admins should NOT have access to personal data
-- If admin access is needed for support, implement a separate audited access system