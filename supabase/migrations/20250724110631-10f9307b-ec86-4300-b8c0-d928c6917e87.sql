-- Fix all database functions to prevent search path injection attacks
-- This addresses the critical security vulnerability in all 9 database functions

-- 1. Fix handle_updated_at function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- 2. Fix has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$function$;

-- 3. Fix is_admin_or_owner function
CREATE OR REPLACE FUNCTION public.is_admin_or_owner(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('owner', 'admin')
  )
$function$;

-- 4. Fix cleanup_expired_2fa_codes function
CREATE OR REPLACE FUNCTION public.cleanup_expired_2fa_codes()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  DELETE FROM public.user_2fa_codes 
  WHERE expires_at < now() OR used = true;
END;
$function$;

-- 5. Fix update_ai_workspaces_updated_at function
CREATE OR REPLACE FUNCTION public.update_ai_workspaces_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- 6. Fix update_post_like_count function
CREATE OR REPLACE FUNCTION public.update_post_like_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.social_posts 
    SET like_count = like_count + 1
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.social_posts 
    SET like_count = like_count - 1
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

-- 7. Fix update_post_comment_count function
CREATE OR REPLACE FUNCTION public.update_post_comment_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.social_posts 
    SET comment_count = comment_count + 1
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.social_posts 
    SET comment_count = comment_count - 1
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

-- 8. Fix update_post_reply_stats function
CREATE OR REPLACE FUNCTION public.update_post_reply_stats()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.forum_posts 
    SET reply_count = reply_count + 1,
        last_reply_at = NEW.created_at
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.forum_posts 
    SET reply_count = reply_count - 1,
        last_reply_at = (
          SELECT MAX(created_at) 
          FROM public.forum_replies 
          WHERE post_id = OLD.post_id
        )
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

-- 9. Fix log_user_action function
CREATE OR REPLACE FUNCTION public.log_user_action(p_user_id uuid, p_action text, p_resource_type text, p_resource_id text DEFAULT NULL::text, p_details jsonb DEFAULT NULL::jsonb, p_ip_address inet DEFAULT NULL::inet, p_user_agent text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
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

-- 10. Fix handle_new_user function 
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  user_count INTEGER;
BEGIN
  -- Insert profile with default settings
  INSERT INTO public.profiles (
    id, 
    email, 
    full_name,
    currency_code,
    timezone,
    country_code,
    language_code,
    date_format,
    time_format
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'USD',
    'UTC',
    'US',
    'en',
    'MM/DD/YYYY',
    '12h'
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
$function$;

-- Fix 2FA code expiry time (reduce from 10 minutes to 5 minutes)
ALTER TABLE public.user_2fa_codes 
ALTER COLUMN expires_at SET DEFAULT (now() + '00:05:00'::interval);

-- Add additional security policies to prevent role self-modification
CREATE POLICY "Prevent users from modifying their own roles" 
ON public.user_roles 
FOR UPDATE 
USING (
  NOT (auth.uid() = user_id AND OLD.role != NEW.role)
);

-- Add rate limiting table for 2FA attempts
CREATE TABLE IF NOT EXISTS public.user_2fa_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email text,
  attempt_count integer DEFAULT 1,
  last_attempt_at timestamp with time zone DEFAULT now(),
  blocked_until timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on rate limiting table
ALTER TABLE public.user_2fa_attempts ENABLE ROW LEVEL SECURITY;

-- Add policy for 2FA attempts
CREATE POLICY "Users can view their own 2FA attempts" 
ON public.user_2fa_attempts 
FOR SELECT 
USING (auth.uid() = user_id OR email = auth.email());

CREATE POLICY "System can manage 2FA attempts" 
ON public.user_2fa_attempts 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Add function to check 2FA rate limiting
CREATE OR REPLACE FUNCTION public.check_2fa_rate_limit(p_email text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
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