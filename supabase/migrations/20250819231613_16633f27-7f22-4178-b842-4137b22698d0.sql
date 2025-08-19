-- Comprehensive fix for Security Definer View issues

-- Find and remove any remaining problematic views
DO $$
DECLARE
    view_name TEXT;
    view_schema TEXT;
BEGIN
    -- Get all views in public schema and check for SECURITY DEFINER
    FOR view_schema, view_name IN
        SELECT n.nspname, c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'v' 
        AND n.nspname = 'public'
    LOOP
        -- Check if view definition contains SECURITY DEFINER
        IF EXISTS (
            SELECT 1 FROM pg_views 
            WHERE schemaname = view_schema 
            AND viewname = view_name 
            AND definition ILIKE '%SECURITY DEFINER%'
        ) THEN
            RAISE NOTICE 'Dropping SECURITY DEFINER view: %.%', view_schema, view_name;
            EXECUTE format('DROP VIEW IF EXISTS %I.%I CASCADE', view_schema, view_name);
        END IF;
    END LOOP;
END $$;

-- Specifically check for and remove any system views that might have SECURITY DEFINER
DROP VIEW IF EXISTS public.user_integrations_safe CASCADE;

-- Also check for any views that might be named differently but have SECURITY DEFINER
SELECT viewname, definition 
FROM pg_views 
WHERE schemaname = 'public' 
AND (definition ILIKE '%SECURITY DEFINER%' OR definition ILIKE '%security definer%');

-- Make sure our replacement function is properly set up
-- If the get_user_integrations_safe function was not created properly, recreate it
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

-- Final check - list all remaining views to ensure none have SECURITY DEFINER
SELECT 
    schemaname,
    viewname,
    CASE 
        WHEN definition ILIKE '%SECURITY DEFINER%' THEN 'HAS_SECURITY_DEFINER'
        ELSE 'CLEAN'
    END as security_status
FROM pg_views 
WHERE schemaname = 'public'
ORDER BY viewname;