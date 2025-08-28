-- Final cleanup of any remaining Security Definer Views
-- Check if there are any views still containing SECURITY DEFINER and remove them

DO $$
DECLARE
    view_name_var text;
    view_definition text;
BEGIN
    -- Look for any remaining views with SECURITY DEFINER
    FOR view_name_var IN 
        SELECT viewname 
        FROM pg_views 
        WHERE schemaname = 'public'
    LOOP
        -- Get the view definition
        SELECT definition INTO view_definition
        FROM pg_views 
        WHERE schemaname = 'public' AND viewname = view_name_var;
        
        -- If view contains SECURITY DEFINER, drop it
        IF view_definition ILIKE '%SECURITY DEFINER%' THEN
            RAISE NOTICE 'Dropping remaining SECURITY DEFINER view: %', view_name_var;
            EXECUTE format('DROP VIEW IF EXISTS public.%I CASCADE', view_name_var);
        END IF;
    END LOOP;
END $$;

-- Ensure there are no more SECURITY DEFINER views
-- All integration access should now go through secure functions
COMMENT ON FUNCTION public.get_user_integrations_safe IS 'Secure function to access user integrations without sensitive token data - replaces any SECURITY DEFINER views';