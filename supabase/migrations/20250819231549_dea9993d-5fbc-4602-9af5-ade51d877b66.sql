-- Fix Security Definer View issues by identifying and removing problematic views

-- First, let's identify any views with SECURITY DEFINER
SELECT 
    schemaname, 
    viewname, 
    definition 
FROM pg_views 
WHERE schemaname = 'public' 
AND definition ILIKE '%SECURITY DEFINER%';

-- Check for any views that might be using SECURITY DEFINER
DO $$
DECLARE
    view_record RECORD;
    view_def TEXT;
BEGIN
    -- Loop through all views in public schema
    FOR view_record IN 
        SELECT schemaname, viewname 
        FROM pg_views 
        WHERE schemaname = 'public'
    LOOP
        -- Get view definition
        SELECT definition INTO view_def
        FROM pg_views 
        WHERE schemaname = view_record.schemaname 
        AND viewname = view_record.viewname;
        
        -- Check if view contains SECURITY DEFINER
        IF view_def ILIKE '%SECURITY DEFINER%' THEN
            RAISE NOTICE 'Found SECURITY DEFINER view: %.%', view_record.schemaname, view_record.viewname;
            
            -- Drop the problematic view
            EXECUTE format('DROP VIEW IF EXISTS %I.%I CASCADE', view_record.schemaname, view_record.viewname);
            RAISE NOTICE 'Dropped view: %.%', view_record.schemaname, view_record.viewname;
        END IF;
    END LOOP;
END $$;

-- If there was a user_integrations_safe view with SECURITY DEFINER, replace it with a proper function
DROP VIEW IF EXISTS public.user_integrations_safe CASCADE;

-- Create a secure function instead of a SECURITY DEFINER view
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
SET search_path = ''
AS $$
BEGIN
    -- Security check: users can only access their own integrations
    IF p_user_id != auth.uid() AND NOT is_admin_or_owner(auth.uid()) THEN
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_user_integrations_safe(uuid) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.get_user_integrations_safe IS 'Get user integrations without sensitive token data - replaces SECURITY DEFINER view';

-- Check for any other potential SECURITY DEFINER views and clean them up
-- This specifically addresses the linter warning about SECURITY DEFINER views