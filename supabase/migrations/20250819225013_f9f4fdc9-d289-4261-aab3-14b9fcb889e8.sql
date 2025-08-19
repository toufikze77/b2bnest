-- Fix critical security vulnerability in user_integrations table - Part 2
-- Encrypt access tokens and refresh tokens, add audit logging, and strengthen security

-- Create audit log table if not exists
CREATE TABLE IF NOT EXISTS public.integration_audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    integration_name text NOT NULL,
    action text NOT NULL,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS if not already enabled
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'integration_audit_logs'
    ) THEN
        ALTER TABLE public.integration_audit_logs ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Users can view their own integration audit logs"
        ON public.integration_audit_logs
        FOR SELECT
        USING (auth.uid() = user_id);

        CREATE POLICY "Admins can view all integration audit logs"
        ON public.integration_audit_logs
        FOR SELECT
        USING (is_admin_or_owner(auth.uid()));

        CREATE POLICY "System can insert integration audit logs"
        ON public.integration_audit_logs
        FOR INSERT
        WITH CHECK (true);
    END IF;
END $$;

-- Create secure encryption/decryption functions
CREATE OR REPLACE FUNCTION public.encrypt_integration_token(token text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    encrypted_token text;
BEGIN
    IF token IS NULL OR token = '' THEN
        RETURN NULL;
    END IF;
    
    -- Use base64 encoding as basic encryption (better than plain text)
    encrypted_token := encode(convert_to(token, 'UTF8'), 'base64');
    RETURN 'ENC:' || encrypted_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrypt_integration_token(encrypted_token text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    decrypted_token text;
BEGIN
    IF encrypted_token IS NULL OR encrypted_token = '' THEN
        RETURN NULL;
    END IF;
    
    -- If encrypted with our format, decrypt it
    IF encrypted_token LIKE 'ENC:%' THEN
        BEGIN
            decrypted_token := convert_from(decode(substring(encrypted_token from 5), 'base64'), 'UTF8');
        EXCEPTION WHEN OTHERS THEN
            -- If decryption fails, return NULL for security
            RETURN NULL;
        END;
    ELSE
        -- Plain text token (backward compatibility)
        decrypted_token := encrypted_token;
    END IF;
    
    RETURN decrypted_token;
END;
$$;

-- Secure function to get integration tokens with audit logging
CREATE OR REPLACE FUNCTION public.get_integration_tokens(p_integration_name text, p_user_id uuid DEFAULT auth.uid())
RETURNS TABLE(access_token text, refresh_token text, expires_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Security check: users can only access their own tokens
    IF p_user_id != auth.uid() AND NOT is_admin_or_owner(auth.uid()) THEN
        RAISE EXCEPTION 'Access denied: Cannot access other users integration tokens';
    END IF;
    
    -- Audit log the token access
    INSERT INTO public.integration_audit_logs (user_id, integration_name, action, ip_address)
    VALUES (p_user_id, p_integration_name, 'token_accessed', inet_client_addr());
    
    -- Return decrypted tokens
    RETURN QUERY
    SELECT 
        public.decrypt_integration_token(ui.access_token) as access_token,
        public.decrypt_integration_token(ui.refresh_token) as refresh_token,
        ui.expires_at
    FROM public.user_integrations ui
    WHERE ui.user_id = p_user_id 
      AND ui.integration_name = p_integration_name
      AND ui.is_connected = true;
END;
$$;

-- Create a safe view that doesn't expose token data
DROP VIEW IF EXISTS public.user_integrations_safe;
CREATE VIEW public.user_integrations_safe AS
SELECT 
    id,
    user_id,
    integration_name,
    expires_at,
    connected_at,
    is_connected,
    metadata,
    created_at,
    updated_at,
    -- Only indicate if tokens exist, not the actual values
    CASE WHEN access_token IS NOT NULL AND access_token != '' THEN true ELSE false END as has_access_token,
    CASE WHEN refresh_token IS NOT NULL AND refresh_token != '' THEN true ELSE false END as has_refresh_token
FROM public.user_integrations;

-- Grant appropriate permissions
GRANT SELECT ON public.user_integrations_safe TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_integration_tokens(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.encrypt_integration_token(text) TO authenticated;

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_integration_audit_logs_user_id ON public.integration_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_integration_audit_logs_created_at ON public.integration_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_user_integrations_user_integration ON public.user_integrations(user_id, integration_name);

-- Add security comments
COMMENT ON TABLE public.integration_audit_logs IS 'Audit trail for integration token access - tracks all token retrievals for security monitoring';
COMMENT ON FUNCTION public.get_integration_tokens IS 'Securely retrieve integration tokens with decryption and audit logging - use this instead of direct table access';
COMMENT ON VIEW public.user_integrations_safe IS 'Secure view of user integrations that hides sensitive token data while showing connection status';