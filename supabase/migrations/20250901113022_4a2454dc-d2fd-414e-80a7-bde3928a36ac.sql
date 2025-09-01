-- Create organization for user and migrate existing data
DO $$
DECLARE
  user_id_param UUID := '3eac00c6-b29d-4dff-aef6-d9b1159e5c17';
  org_id UUID;
  user_email TEXT;
BEGIN
  -- Get user email from profiles
  SELECT email INTO user_email FROM profiles WHERE id = user_id_param;
  
  -- Create organization for the user
  INSERT INTO organizations (name, slug, created_by, subscription_tier)
  VALUES (
    COALESCE(user_email, 'user') || '''s Organization',
    LOWER(REPLACE(COALESCE(user_email, 'user'), ' ', '-')) || '-org-' || EXTRACT(epoch FROM now())::text,
    user_id_param,
    'free'
  )
  RETURNING id INTO org_id;
  
  -- Add user as owner of the organization
  INSERT INTO organization_members (organization_id, user_id, role, is_active)
  VALUES (org_id, user_id_param, 'owner', true);
  
  -- Migrate existing projects to the organization
  UPDATE projects 
  SET organization_id = org_id
  WHERE user_id = user_id_param AND organization_id IS NULL;
  
  -- Migrate existing todos to the organization  
  UPDATE todos
  SET organization_id = org_id
  WHERE user_id = user_id_param AND organization_id IS NULL;
  
  -- Update project_time_entries to have organization_id
  UPDATE project_time_entries
  SET organization_id = org_id
  WHERE user_id = user_id_param AND organization_id IS NULL;
  
  RAISE NOTICE 'Successfully created organization % and migrated data for user %', org_id, user_id_param;
END $$;