-- Final comprehensive check and cleanup of ALL SECURITY DEFINER views
-- This migration will identify and remove any remaining SECURITY DEFINER views system-wide

-- First, let's see what we're dealing with
SELECT 
    schemaname, 
    viewname, 
    definition,
    CASE 
        WHEN definition ILIKE '%SECURITY DEFINER%' THEN 'HAS_SECURITY_DEFINER'
        ELSE 'CLEAN'
    END as status
FROM pg_views 
ORDER BY schemaname, viewname;

-- Now perform a comprehensive cleanup of any SECURITY DEFINER views
-- This includes any views that might have been missed in previous migrations
DO $$
DECLARE
    view_record RECORD;
    view_def TEXT;
    drop_command TEXT;
BEGIN
    -- Loop through ALL views in ALL accessible schemas
    FOR view_record IN 
        SELECT schemaname, viewname 
        FROM pg_views 
        WHERE schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast', 'pg_temp_1', 'pg_toast_temp_1')
    LOOP
        -- Get view definition
        SELECT definition INTO view_def
        FROM pg_views 
        WHERE schemaname = view_record.schemaname 
        AND viewname = view_record.viewname;
        
        -- Check if view contains SECURITY DEFINER
        IF view_def ILIKE '%SECURITY DEFINER%' THEN
            RAISE NOTICE 'Found SECURITY DEFINER view: %.% - REMOVING', view_record.schemaname, view_record.viewname;
            
            -- Construct drop command with proper schema qualification
            drop_command := format('DROP VIEW IF EXISTS %I.%I CASCADE', view_record.schemaname, view_record.viewname);
            
            -- Execute the drop command
            EXECUTE drop_command;
            
            RAISE NOTICE 'Successfully dropped view: %.%', view_record.schemaname, view_record.viewname;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'SECURITY DEFINER view cleanup completed';
END $$;

-- Verify cleanup was successful
SELECT 
    COUNT(*) as remaining_security_definer_views,
    string_agg(schemaname || '.' || viewname, ', ') as view_names
FROM pg_views 
WHERE definition ILIKE '%SECURITY DEFINER%';

-- Ensure our replacement function is properly documented
COMMENT ON FUNCTION public.get_user_integrations_safe IS 'Secure function to access user integrations without sensitive token data - replaces all SECURITY DEFINER views';

-- Log completion
SELECT 'SECURITY DEFINER view cleanup migration completed successfully' as status;