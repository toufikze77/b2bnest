-- CRITICAL SECURITY FIX: Harden all database functions against search path injection
-- This prevents potential privilege escalation attacks by ensuring functions use an empty search path

-- Fix functions that currently use 'SET search_path TO public' or are missing the setting entirely

-- 1. Fix update_project_time_entries_updated_at (missing SET search_path)
CREATE OR REPLACE FUNCTION public.update_project_time_entries_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- 2. Fix is_safe_profile_field (currently uses 'public')
CREATE OR REPLACE FUNCTION public.is_safe_profile_field(field_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  -- Only allow these safe fields to be publicly visible
  SELECT field_name = ANY(ARRAY[
    'id',
    'display_name', 
    'headline',
    'bio',
    'skills',
    'industry',
    'experience_years',
    'created_at',
    'avatar_url'
  ]);
$function$;

-- 3. Fix create_user_organization (currently uses 'public')
CREATE OR REPLACE FUNCTION public.create_user_organization()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  org_id UUID;
BEGIN
  -- Create personal organization for the user
  INSERT INTO public.organizations (name, slug, created_by)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)) || '''s Organization',
    LOWER(REPLACE(COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)), ' ', '-')) || '-org-' || EXTRACT(epoch FROM now())::text,
    NEW.id
  )
  RETURNING id INTO org_id;
  
  -- Add user as owner of the organization
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (org_id, NEW.id, 'owner');
  
  RETURN NEW;
END;
$function$;

-- 4. Fix add_team_member (currently uses 'public')
CREATE OR REPLACE FUNCTION public.add_team_member(p_team_id uuid, p_user_id uuid, p_role text DEFAULT 'member'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  result JSON;
BEGIN
  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (p_team_id, p_user_id, p_role)
  ON CONFLICT (team_id, user_id) 
  DO UPDATE SET 
    role = EXCLUDED.role,
    updated_at = now()
  RETURNING to_json(team_members.*) INTO result;
  
  RETURN result;
END;
$function$;

-- 5. Fix add_project_member (currently uses 'public')
CREATE OR REPLACE FUNCTION public.add_project_member(p_project_id uuid, p_user_id uuid, p_role text DEFAULT 'contributor'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  result JSON;
BEGIN
  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (p_project_id, p_user_id, p_role)
  ON CONFLICT (project_id, user_id) 
  DO UPDATE SET 
    role = EXCLUDED.role,
    updated_at = now()
  RETURNING to_json(project_members.*) INTO result;
  
  RETURN result;
END;
$function$;

-- 6. Fix cleanup_expired_2fa_codes (currently uses 'public')
CREATE OR REPLACE FUNCTION public.cleanup_expired_2fa_codes()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  DELETE FROM public.user_2fa_codes 
  WHERE expires_at < now() OR used = true;
END;
$function$;

-- 7. Fix user_owns_project (currently uses 'public')
CREATE OR REPLACE FUNCTION public.user_owns_project(project_id uuid, check_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 
    FROM public.projects p
    WHERE p.id = project_id 
      AND p.user_id = check_user_id
  );
$function$;

-- 8. Fix check_2fa_rate_limit (currently uses 'public')
CREATE OR REPLACE FUNCTION public.check_2fa_rate_limit(p_email text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  attempt_record RECORD;
  current_time timestamp with time zone := now();
BEGIN
  -- Get or create attempt record
  SELECT * INTO attempt_record 
  FROM public.user_2fa_attempts 
  WHERE email = p_email 
  ORDER BY created_at DESC 
  LIMIT 1;
  
  -- If no record exists or it's been more than 5 minutes, allow
  IF attempt_record IS NULL OR 
     (current_time - attempt_record.last_attempt_at) > interval '5 minutes' THEN
    
    -- Reset or create new record
    INSERT INTO public.user_2fa_attempts (email, attempt_count, last_attempt_at)
    VALUES (p_email, 1, current_time)
    ON CONFLICT (email) DO UPDATE SET
      attempt_count = 1,
      last_attempt_at = current_time,
      blocked_until = NULL;
    
    RETURN true;
  END IF;
  
  -- If currently blocked, check if block period is over
  IF attempt_record.blocked_until IS NOT NULL AND 
     current_time < attempt_record.blocked_until THEN
    RETURN false;
  END IF;
  
  -- If less than 3 attempts in 5 minutes, allow
  IF attempt_record.attempt_count < 3 THEN
    UPDATE public.user_2fa_attempts 
    SET attempt_count = attempt_count + 1,
        last_attempt_at = current_time
    WHERE email = p_email;
    RETURN true;
  END IF;
  
  -- Block for 15 minutes after 3 attempts
  UPDATE public.user_2fa_attempts 
  SET blocked_until = current_time + interval '15 minutes',
      last_attempt_at = current_time
  WHERE email = p_email;
  
  RETURN false;
END;
$function$;

-- 9. Fix log_user_action (currently uses 'public')
CREATE OR REPLACE FUNCTION public.log_user_action(p_user_id uuid, p_action text, p_resource_type text, p_resource_id text DEFAULT NULL::text, p_details jsonb DEFAULT NULL::jsonb, p_ip_address inet DEFAULT NULL::inet, p_user_agent text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    details,
    ip_address,
    user_agent
  )
  VALUES (
    p_user_id,
    p_action,
    p_resource_type,
    p_resource_id,
    p_details,
    p_ip_address,
    p_user_agent
  )
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$function$;

-- 10. Fix get_team_members_with_profiles (currently uses 'public')
CREATE OR REPLACE FUNCTION public.get_team_members_with_profiles(p_team_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(
    json_build_object(
      'id', tm.id,
      'team_id', tm.team_id,
      'user_id', tm.user_id,
      'role', tm.role,
      'joined_at', tm.joined_at,
      'created_at', tm.created_at,
      'user', json_build_object(
        'id', pr.id,
        'email', pr.email,
        'full_name', pr.full_name,
        'display_name', pr.display_name,
        'avatar_url', pr.avatar_url
      )
    )
  ) INTO result
  FROM public.team_members tm
  LEFT JOIN public.profiles pr ON tm.user_id = pr.id
  WHERE tm.team_id = p_team_id;
  
  RETURN COALESCE(result, '[]'::json);
END;
$function$;

-- 11. Fix handle_new_user (currently uses 'public')
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  user_count INTEGER;
  org_id UUID;
BEGIN
  -- Insert profile with default settings including display_name
  INSERT INTO public.profiles (
    id, 
    email, 
    full_name,
    display_name,
    currency_code,
    timezone,
    country_code,
    language_code,
    date_format,
    time_format,
    is_active
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    'USD',
    'UTC',
    'US',
    'en',
    'MM/DD/YYYY',
    '12h',
    true
  );
  
  -- Create personal organization for the user
  INSERT INTO public.organizations (name, slug, created_by)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)) || '''s Organization',
    LOWER(REPLACE(COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)), ' ', '-')) || '-org-' || EXTRACT(epoch FROM now())::text,
    NEW.id
  )
  RETURNING id INTO org_id;
  
  -- Add user as owner of the organization
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (org_id, NEW.id, 'owner');
  
  -- Check if this is the first user for system-wide admin roles
  SELECT COUNT(*) INTO user_count FROM auth.users;
  
  -- Assign system role (separate from organization roles)
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'owner');
    
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      NEW.id,
      'Welcome, System Owner!',
      'You have been assigned as the owner of this platform with full administrative rights.',
      'welcome'
    );
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
    
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      NEW.id,
      'Welcome to BusinessForms Pro!',
      'Thank you for joining us. You now have your own organization workspace.',
      'welcome'
    );
  END IF;

  -- Enable 2FA by default for all new users
  INSERT INTO public.user_2fa_settings (user_id, is_enabled, email_verified)
  VALUES (NEW.id, true, false);
  
  RETURN NEW;
END;
$function$;

-- 12. Fix get_user_teams (currently uses 'public')
CREATE OR REPLACE FUNCTION public.get_user_teams(p_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(
    json_build_object(
      'id', t.id,
      'name', t.name,
      'created_at', t.created_at
    )
  ) INTO result
  FROM public.teams t
  INNER JOIN public.team_members tm ON t.id = tm.team_id
  WHERE tm.user_id = p_user_id;
  
  RETURN COALESCE(result, '[]'::json);
END;
$function$;

-- 13. Fix user_can_access_project (currently uses 'public')
CREATE OR REPLACE FUNCTION public.user_can_access_project(project_id uuid, check_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 
    FROM public.projects p
    LEFT JOIN public.organization_members om ON p.organization_id = om.organization_id
    WHERE p.id = project_id 
      AND (p.user_id = check_user_id OR (om.user_id = check_user_id AND om.is_active = true))
  );
$function$;

-- 14. Fix user_is_organization_member (currently uses 'public')
CREATE OR REPLACE FUNCTION public.user_is_organization_member(org_id uuid, check_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 
    FROM public.organization_members om
    WHERE om.organization_id = org_id 
      AND om.user_id = check_user_id 
      AND om.is_active = true
  );
$function$;

-- 15. Fix user_is_organization_admin (currently uses 'public')
CREATE OR REPLACE FUNCTION public.user_is_organization_admin(org_id uuid, check_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 
    FROM public.organization_members om
    WHERE om.organization_id = org_id 
      AND om.user_id = check_user_id 
      AND om.role IN ('owner', 'admin')
      AND om.is_active = true
  );
$function$;

-- 16. Fix get_user_projects (currently uses 'public')
CREATE OR REPLACE FUNCTION public.get_user_projects(p_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  result JSON;
BEGIN
  -- Get projects where user is organization member OR direct project member
  SELECT json_agg(
    json_build_object(
      'id', p.id,
      'name', p.name,
      'description', p.description,
      'status', p.status,
      'progress', p.progress,
      'deadline', p.deadline,
      'client', p.client,
      'color', p.color,
      'created_at', p.created_at,
      'updated_at', p.updated_at,
      'budget', p.budget,
      'priority', p.priority,
      'stage', p.stage
    )
  ) INTO result
  FROM public.projects p
  LEFT JOIN public.organization_members om ON p.organization_id = om.organization_id
  LEFT JOIN public.project_members pm ON p.id = pm.project_id
  WHERE om.user_id = p_user_id OR pm.user_id = p_user_id OR p.user_id = p_user_id;
  
  RETURN COALESCE(result, '[]'::json);
END;
$function$;

-- 17. Fix is_admin_or_owner (currently uses 'public')
CREATE OR REPLACE FUNCTION public.is_admin_or_owner(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('owner', 'admin')
  )
$function$;

-- 18. Fix has_role (currently uses 'public')
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$function$;