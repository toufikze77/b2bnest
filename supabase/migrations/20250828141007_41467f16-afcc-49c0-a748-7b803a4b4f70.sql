-- Fix Security Definer View issue by dropping the advertisements_public view
-- The view bypasses RLS policies and is owned by postgres (superuser)
-- The base advertisements table already has proper RLS policies for public access

DROP VIEW IF EXISTS public.advertisements_public;