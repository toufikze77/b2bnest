-- Fix security issue: User IDs and Personal Activity Exposed to Anyone
-- Restrict access to post_comments, post_likes, forum_posts, and social_posts tables to authenticated users only

-- First, let's check if post_likes table exists and create it if needed
CREATE TABLE IF NOT EXISTS public.post_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  post_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);

-- Enable RLS on post_likes if not already enabled
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

-- Drop existing overly permissive policies that allow anonymous access to user data
DROP POLICY IF EXISTS "Anyone can view comments on public posts" ON public.post_comments;
DROP POLICY IF EXISTS "Anyone can view public posts" ON public.social_posts;
DROP POLICY IF EXISTS "Anyone can view forum posts" ON public.forum_posts;

-- Create secure RLS policies that require authentication to view user data

-- POST_COMMENTS: Only authenticated users can view comments
CREATE POLICY "Authenticated users can view comments" 
ON public.post_comments 
FOR SELECT 
TO authenticated
USING (true);

-- SOCIAL_POSTS: Only authenticated users can view posts (protects user IDs from exposure)
CREATE POLICY "Authenticated users can view public posts" 
ON public.social_posts 
FOR SELECT 
TO authenticated
USING (is_public = true);

-- FORUM_POSTS: Only authenticated users can view forum posts
CREATE POLICY "Authenticated users can view forum posts" 
ON public.forum_posts 
FOR SELECT 
TO authenticated
USING (true);

-- POST_LIKES: Create secure policies for likes
CREATE POLICY "Authenticated users can view likes" 
ON public.post_likes 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create likes" 
ON public.post_likes 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own likes" 
ON public.post_likes 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);

-- Add audit logging for sensitive data access
CREATE TABLE IF NOT EXISTS public.security_audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  action text NOT NULL,
  table_name text NOT NULL,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on audit logs
ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view security audit logs" 
ON public.security_audit_logs 
FOR SELECT 
TO authenticated
USING (is_admin_or_owner(auth.uid()));

-- System can insert audit logs
CREATE POLICY "System can insert security audit logs" 
ON public.security_audit_logs 
FOR INSERT 
TO authenticated
WITH CHECK (true);