
-- Revoke direct SELECT on sensitive OAuth token columns; tokens must be fetched via SECURITY DEFINER RPCs
REVOKE SELECT (access_token, refresh_token) ON public.hmrc_integrations FROM anon, authenticated;
REVOKE SELECT (access_token, refresh_token) ON public.user_integrations FROM anon, authenticated;

-- Revoke direct SELECT on HMRC client_secret; must be fetched via get_hmrc_client_secret RPC
REVOKE SELECT (client_secret) ON public.hmrc_settings FROM anon, authenticated;

-- Revoke direct SELECT on invitation token column to prevent admins reading other users' tokens
REVOKE SELECT (token) ON public.organization_invitations FROM anon, authenticated;
