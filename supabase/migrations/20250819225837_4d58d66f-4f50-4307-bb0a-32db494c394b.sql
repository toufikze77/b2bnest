-- Create the store_integration_tokens function that was missing
CREATE OR REPLACE FUNCTION public.store_integration_tokens(
    p_integration_name text,
    p_access_token text,
    p_refresh_token text DEFAULT NULL,
    p_expires_at timestamp with time zone DEFAULT NULL,
    p_metadata jsonb DEFAULT '{}'::jsonb,
    p_user_id uuid DEFAULT auth.uid()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    integration_id uuid;
    encrypted_access_token text;
    encrypted_refresh_token text;
BEGIN
    -- Verify user can only store their own tokens
    IF p_user_id != auth.uid() AND NOT is_admin_or_owner(auth.uid()) THEN
        RAISE EXCEPTION 'Access denied: Cannot store tokens for other users';
    END IF;
    
    -- Encrypt the tokens
    encrypted_access_token := public.encrypt_integration_token(p_access_token);
    encrypted_refresh_token := CASE 
        WHEN p_refresh_token IS NOT NULL THEN public.encrypt_integration_token(p_refresh_token)
        ELSE NULL
    END;
    
    -- Insert or update the integration
    INSERT INTO public.user_integrations (
        user_id,
        integration_name,
        access_token,
        refresh_token,
        expires_at,
        metadata,
        is_connected,
        connected_at
    )
    VALUES (
        p_user_id,
        p_integration_name,
        encrypted_access_token,
        encrypted_refresh_token,
        p_expires_at,
        p_metadata,
        true,
        now()
    )
    ON CONFLICT (user_id, integration_name) 
    DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        expires_at = EXCLUDED.expires_at,
        metadata = EXCLUDED.metadata,
        is_connected = EXCLUDED.is_connected,
        connected_at = EXCLUDED.connected_at,
        updated_at = now()
    RETURNING id INTO integration_id;
    
    -- Log the token storage
    INSERT INTO public.integration_audit_logs (user_id, integration_name, action, ip_address)
    VALUES (p_user_id, p_integration_name, 'token_created', inet_client_addr());
    
    RETURN integration_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.store_integration_tokens(text, text, text, timestamp with time zone, jsonb, uuid) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.store_integration_tokens IS 'Securely store encrypted integration tokens with audit logging - use this instead of direct table inserts';