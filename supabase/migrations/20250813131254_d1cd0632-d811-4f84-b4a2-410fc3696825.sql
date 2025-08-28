-- Fix remaining security definer functions with proper search_path

-- Fix the main functions that we know need search_path

-- 1. Fix handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path TO 'public'
AS $$
DECLARE
  user_count INTEGER;
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
  
  -- Check if this is the first user
  SELECT COUNT(*) INTO user_count FROM auth.users;
  
  -- Assign owner role to first user, regular user role to others
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'owner');
    
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      NEW.id,
      'Welcome, Owner!',
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
      'Thank you for joining us. Please contact the administrator for upload permissions.',
      'welcome'
    );
  END IF;

  -- Enable 2FA by default for all new users
  INSERT INTO public.user_2fa_settings (user_id, is_enabled, email_verified)
  VALUES (NEW.id, true, false);
  
  RETURN NEW;
END;
$$;

-- 2. Fix cleanup_expired_2fa_codes function
CREATE OR REPLACE FUNCTION public.cleanup_expired_2fa_codes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.user_2fa_codes 
  WHERE expires_at < now() OR used = true;
END;
$$;

-- 3. Fix check_2fa_rate_limit function
CREATE OR REPLACE FUNCTION public.check_2fa_rate_limit(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

-- 4. Fix log_user_action function  
CREATE OR REPLACE FUNCTION public.log_user_action(p_user_id uuid, p_action text, p_resource_type text, p_resource_id text DEFAULT NULL::text, p_details jsonb DEFAULT NULL::jsonb, p_ip_address inet DEFAULT NULL::inet, p_user_agent text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

-- 5. Fix has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 6. Fix is_admin_or_owner function
CREATE OR REPLACE FUNCTION public.is_admin_or_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('owner', 'admin')
  )
$$;