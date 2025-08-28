-- Alternative approach: Check for any remaining problematic database objects

-- Check if there are any functions that might be flagged incorrectly
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE pg_get_functiondef(p.oid) ILIKE '%SECURITY DEFINER%'
AND n.nspname = 'public'
AND p.proname LIKE '%view%'
ORDER BY n.nspname, p.proname;

-- Check for any triggers that might be related
SELECT 
    t.tgname as trigger_name,
    n.nspname as schema_name,
    c.relname as table_name,
    pg_get_triggerdef(t.oid) as trigger_definition
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE pg_get_triggerdef(t.oid) ILIKE '%SECURITY DEFINER%'
AND n.nspname = 'public'
ORDER BY n.nspname, c.relname, t.tgname;

-- Let's also check if the linter might be confusing our SECURITY DEFINER functions with views
-- Create a simple test view to see if that resolves the issue
CREATE OR REPLACE VIEW public.test_view_clean AS
SELECT 'test' as test_column;

-- Grant appropriate permissions
GRANT SELECT ON public.test_view_clean TO authenticated;

-- Add RLS to the test view (this should be clean)
-- Note: Views don't have RLS directly, they inherit from underlying tables

-- Now let's try a different approach - check if there are any old migration artifacts
SELECT 
    version,
    name,
    created_by
FROM supabase_migrations.schema_migrations 
WHERE statements::text ILIKE '%SECURITY DEFINER%'
AND statements::text ILIKE '%VIEW%'
ORDER BY version DESC
LIMIT 5;

-- Clean up the test view
DROP VIEW IF EXISTS public.test_view_clean;