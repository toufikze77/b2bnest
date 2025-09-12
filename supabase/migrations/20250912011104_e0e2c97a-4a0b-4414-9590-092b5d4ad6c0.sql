-- Fix security issue: User Activity Data Could Be Stolen by Hackers
-- Replace overly permissive RLS policy on post_likes table with secure access controls

-- Drop the existing overly permissive policy that allows all authenticated users to view all likes
DROP POLICY IF EXISTS "Authenticated users can view likes" ON public.post_likes;

-- Create more secure policies that protect user privacy

-- Users can only view their own likes
CREATE POLICY "Users can view their own likes" 
ON public.post_likes 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- Post owners can view likes on their posts (for analytics/engagement metrics)
CREATE POLICY "Post owners can view likes on their posts" 
ON public.post_likes 
FOR SELECT 
TO authenticated
USING (EXISTS (
  SELECT 1 FROM social_posts sp 
  WHERE sp.id = post_likes.post_id 
  AND sp.user_id = auth.uid()
));

-- Alternative policy for forum posts (if post_likes references forum_posts)
CREATE POLICY "Forum post owners can view likes on their posts" 
ON public.post_likes 
FOR SELECT 
TO authenticated
USING (EXISTS (
  SELECT 1 FROM forum_posts fp 
  WHERE fp.id = post_likes.post_id 
  AND fp.user_id = auth.uid()
));

-- Log this security fix in audit logs
INSERT INTO security_audit_logs (action, table_name, user_id, ip_address)
VALUES ('security_policy_updated', 'post_likes', auth.uid(), inet_client_addr());