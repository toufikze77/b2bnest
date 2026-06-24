
-- 1) HMRC integrations: revoke table-wide SELECT, grant only non-token columns
REVOKE SELECT ON public.hmrc_integrations FROM authenticated, anon;
GRANT SELECT (id, user_id, organization_id, expires_at, token_type, scope, is_connected, connected_at, last_refreshed_at, created_at, updated_at)
  ON public.hmrc_integrations TO authenticated;

-- 2) User integrations: revoke table-wide SELECT, grant only non-token columns
REVOKE SELECT ON public.user_integrations FROM authenticated, anon;
GRANT SELECT (id, user_id, integration_name, expires_at, connected_at, is_connected, metadata, created_at, updated_at)
  ON public.user_integrations TO authenticated;

-- 3) Organization invitations: remove unsafe token-lookup policy
DROP POLICY IF EXISTS "Invitees can look up by token" ON public.organization_invitations;

-- Secure accessor: returns at most one invitation matching the exact token supplied.
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_token text)
RETURNS TABLE(
  id uuid,
  organization_id uuid,
  email text,
  role text,
  expires_at timestamp with time zone,
  accepted_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, organization_id, email, role, expires_at, accepted_at
  FROM public.organization_invitations
  WHERE p_token IS NOT NULL
    AND token = p_token
    AND (expires_at IS NULL OR expires_at > now())
    AND accepted_at IS NULL
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_invitation_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO authenticated, anon;
