-- First, ensure is_admin_or_owner function exists
CREATE OR REPLACE FUNCTION public.is_admin_or_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('owner', 'admin')
  )
$$;

-- Update get_user_integrations_safe to handle missing is_admin_or_owner gracefully
CREATE OR REPLACE FUNCTION public.get_user_integrations_safe(p_user_id uuid DEFAULT auth.uid())
RETURNS TABLE(
  id uuid,
  user_id uuid,
  integration_name text,
  is_connected boolean,
  connected_at timestamp with time zone,
  expires_at timestamp with time zone,
  metadata jsonb,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  has_access_token boolean,
  has_refresh_token boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  is_admin boolean;
BEGIN
  -- Check if user is admin/owner
  SELECT public.is_admin_or_owner(auth.uid()) INTO is_admin;
  
  -- Security check: users can only access their own integrations unless they're admin
  IF p_user_id != auth.uid() AND NOT COALESCE(is_admin, false) THEN
    RAISE EXCEPTION 'Access denied: Cannot access other users integration data';
  END IF;
  
  -- Audit log the access
  INSERT INTO public.integration_audit_logs (user_id, integration_name, action, ip_address)
  VALUES (p_user_id, 'all_integrations', 'safe_access', inet_client_addr());
  
  -- Return safe integration data (no tokens)
  RETURN QUERY
  SELECT 
    ui.id,
    ui.user_id,
    ui.integration_name,
    ui.is_connected,
    ui.connected_at,
    ui.expires_at,
    ui.metadata,
    ui.created_at,
    ui.updated_at,
    (ui.access_token IS NOT NULL) as has_access_token,
    (ui.refresh_token IS NOT NULL) as has_refresh_token
  FROM public.user_integrations ui
  WHERE ui.user_id = p_user_id
  ORDER BY ui.created_at DESC;
END;
$$;