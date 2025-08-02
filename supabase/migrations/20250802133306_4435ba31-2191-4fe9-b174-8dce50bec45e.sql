-- Drop the existing conflicting SELECT policies and create a single policy for public viewing
DROP POLICY IF EXISTS "Anyone can view active advertisements" ON public.advertisements;
DROP POLICY IF EXISTS "Users can view their own advertisements" ON public.advertisements;

-- Create a comprehensive SELECT policy that allows:
-- 1. Anyone (including anonymous users) to view active advertisements
-- 2. Authenticated users to view their own advertisements (including inactive ones)
CREATE POLICY "Public can view active advertisements and users can view their own" 
ON public.advertisements 
FOR SELECT 
USING (
  (is_active = true) OR 
  (auth.uid() = user_id)
);