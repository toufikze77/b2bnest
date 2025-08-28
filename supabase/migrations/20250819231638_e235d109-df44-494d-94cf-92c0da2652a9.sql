-- Deep investigation and fix for any remaining SECURITY DEFINER views

-- Check all schemas for any SECURITY DEFINER views
SELECT 
    n.nspname as schema_name,
    c.relname as view_name,
    pg_get_viewdef(c.oid) as view_definition
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace  
WHERE c.relkind = 'v'
AND pg_get_viewdef(c.oid) ILIKE '%SECURITY DEFINER%'
ORDER BY n.nspname, c.relname;

-- Also check for views using different casing or spacing
SELECT 
    schemaname,
    viewname,
    definition
FROM pg_views 
WHERE definition ILIKE '%security%definer%'
   OR definition ILIKE '%definer%'
ORDER BY schemaname, viewname;

-- Check specifically for the auth schema which might have views
SELECT 
    schemaname,
    viewname,
    'AUTH_SCHEMA_VIEW' as note
FROM pg_views 
WHERE schemaname = 'auth'
ORDER BY viewname;

-- Look for any materialized views that might have SECURITY DEFINER
SELECT 
    n.nspname as schema_name,
    c.relname as matview_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace  
WHERE c.relkind = 'm'  -- materialized view
AND n.nspname IN ('public', 'auth', 'storage')
ORDER BY n.nspname, c.relname;

-- Final comprehensive cleanup - drop any views that might still have SECURITY DEFINER
DO $$
DECLARE
    rec RECORD;
    view_def TEXT;
BEGIN
    -- Check every view in every accessible schema
    FOR rec IN 
        SELECT n.nspname as schema_name, c.relname as view_name
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace  
        WHERE c.relkind = 'v'
        AND n.nspname NOT IN ('information_schema', 'pg_catalog')
        AND pg_has_role(c.relowner, 'USAGE')
    LOOP
        BEGIN
            -- Get the view definition
            SELECT pg_get_viewdef(rec.schema_name||'.'||rec.view_name) INTO view_def;
            
            -- Check if it contains SECURITY DEFINER
            IF view_def ILIKE '%SECURITY DEFINER%' THEN
                RAISE NOTICE 'Found SECURITY DEFINER view: %.%', rec.schema_name, rec.view_name;
                
                -- Only drop views in public schema to be safe
                IF rec.schema_name = 'public' THEN
                    EXECUTE format('DROP VIEW IF EXISTS %I.%I CASCADE', rec.schema_name, rec.view_name);
                    RAISE NOTICE 'Dropped view: %.%', rec.schema_name, rec.view_name;
                ELSE
                    RAISE NOTICE 'Skipping system view: %.%', rec.schema_name, rec.view_name;
                END IF;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- Skip views we can't access
            CONTINUE;
        END;
    END LOOP;
END $$;

-- Verify no more SECURITY DEFINER views exist in public schema
SELECT COUNT(*) as remaining_security_definer_views
FROM pg_views 
WHERE schemaname = 'public'
AND definition ILIKE '%SECURITY DEFINER%';