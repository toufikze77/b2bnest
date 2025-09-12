-- Fix critical security vulnerability: User IDs and Activity Data Exposed to Anonymous Users
-- Remove the overly permissive policy that allows anonymous access to post_likes table

-- Drop the dangerous policy that allows anyone (including anonymous users) to view all likes
DROP POLICY IF EXISTS "Anyone can view post likes" ON public.post_likes;

-- Verify we still have the secure policies in place:
-- 1. "Users can view their own likes" - allows users to see only their own likes
-- 2. "Post owners can view likes on their posts" - allows post owners to see engagement on their content  
-- 3. "Forum post owners can view likes on their posts" - same for forum posts
-- These policies ensure user privacy while maintaining necessary functionality

-- Also remove any other overly permissive policies if they exist
DROP POLICY IF EXISTS "Authenticated users can like posts" ON public.post_likes;

-- Ensure we have the proper INSERT policy for authenticated users only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy 
    WHERE polrelid = 'public.post_likes'::regclass 
    AND polname = 'Authenticated users can create likes'
  ) THEN
    CREATE POLICY "Authenticated users can create likes"
    ON public.post_likes 
    FOR INSERT 
    TO authenticated
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Log this critical security fix
INSERT INTO security_audit_logs (action, table_name, user_id, ip_address)
VALUES ('critical_anonymous_access_removed', 'post_likes', auth.uid(), inet_client_addr());