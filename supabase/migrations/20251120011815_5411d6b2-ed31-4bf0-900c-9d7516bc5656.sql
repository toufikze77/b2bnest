-- Fix storage bucket INSERT policies to enforce folder-based access control
-- This prevents users from uploading to other users' folders

-- Drop existing INSERT policies that lack WITH CHECK clauses
DROP POLICY IF EXISTS "Users can upload their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own company logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload advertisement images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload service images" ON storage.objects;

-- Recreate INSERT policies with proper WITH CHECK to enforce folder ownership
CREATE POLICY "Users can upload their own avatars" 
ON storage.objects
FOR INSERT 
TO authenticated
WITH CHECK (
  bucket_id = 'user-avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload their own company logos" 
ON storage.objects
FOR INSERT 
TO authenticated
WITH CHECK (
  bucket_id = 'company-logos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Authenticated users can upload advertisement images" 
ON storage.objects
FOR INSERT 
TO authenticated
WITH CHECK (
  bucket_id = 'advertisement-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Authenticated users can upload service images" 
ON storage.objects
FOR INSERT 
TO authenticated
WITH CHECK (
  bucket_id = 'service-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Fix handle_new_user function to add SET search_path = ''
-- This prevents search path manipulation attacks
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  new_org_id uuid;
  user_display_name text;
BEGIN
  -- Determine display name
  user_display_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'full_name', 
    split_part(NEW.email, '@', 1)
  );

  -- Create profile for new user
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    display_name,
    is_active,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', user_display_name),
    user_display_name,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name, EXCLUDED.email),
    updated_at = NOW();

  -- Create organization if doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members WHERE user_id = NEW.id
  ) THEN
    INSERT INTO public.organizations (
      name,
      slug,
      created_by,
      is_active,
      created_at,
      updated_at
    )
    VALUES (
      user_display_name || '''s Organization',
      'org-' || SUBSTRING(NEW.id::text, 1, 8),
      NEW.id,
      true,
      NOW(),
      NOW()
    )
    RETURNING id INTO new_org_id;

    -- Add user as admin
    INSERT INTO public.organization_members (
      organization_id,
      user_id,
      role,
      is_active,
      joined_at,
      created_at,
      updated_at
    )
    VALUES (
      new_org_id,
      NEW.id,
      'admin',
      true,
      NOW(),
      NOW(),
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$function$;