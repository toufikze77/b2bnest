-- Check for remaining security definer issues and fix them

-- Check for any existing views that might have security definer
DO $$
DECLARE
    r record;
BEGIN
    -- Get all functions that need search_path fixed
    FOR r IN 
        SELECT n.nspname as schema_name, p.proname as function_name
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' 
        AND p.prosecdef = true  -- security definer functions
        AND p.proname != 'get_advertisement_contact_info'  -- exclude the one we just fixed
        AND NOT EXISTS (
            SELECT 1 FROM pg_proc_config 
            WHERE pg_proc_config.oid = p.oid 
            AND setting[1] = 'search_path'
        )
    LOOP
        RAISE NOTICE 'Function %.% needs search_path set', r.schema_name, r.function_name;
    END LOOP;
END $$;

-- Fix any remaining functions with missing search_path (just the critical ones we know about)
-- These are likely from previous migrations

-- Fix the handle_new_user function if it exists
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
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

-- Recreate the trigger if it was dropped
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Fix other critical functions with search_path issues
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