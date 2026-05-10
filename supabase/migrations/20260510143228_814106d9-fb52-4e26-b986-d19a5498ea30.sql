
-- 1. Restrict access to OAuth token columns in user_integrations
-- Tokens should only be accessible via the security-definer get_integration_tokens() RPC
REVOKE SELECT (access_token, refresh_token) ON public.user_integrations FROM authenticated, anon;

-- 2. Remove todo_comments from realtime publication (no RLS exists on realtime.messages
--    to scope subscriptions, so unpublish to prevent cross-user event leakage).
ALTER PUBLICATION supabase_realtime DROP TABLE public.todo_comments;

-- 3. Tighten public storage buckets: drop overly broad listing SELECT policies.
-- Public buckets remain directly downloadable via the storage CDN without RLS.
DROP POLICY IF EXISTS "Anyone can view advertisement images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view service images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view user avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can view company logos" ON storage.objects;
