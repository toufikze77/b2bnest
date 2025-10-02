-- Update the handle_new_user function to set 14-day free trial
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  user_count INTEGER;
  org_id UUID;
BEGIN
  -- Insert profile with default settings including display_name and 14-DAY FREE TRIAL
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
    is_active,
    is_trial_active,
    trial_ends_at,
    trial_expired
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
    true,
    true,
    NOW() + INTERVAL '14 days',
    false
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
      'You have been assigned as the owner of this platform with full administrative rights. Your 14-day free trial has started!',
      'welcome'
    );
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
    
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      NEW.id,
      'Welcome to BizzLink! 🎉',
      'Your 14-day free trial has started! Explore all premium features without any payment details required.',
      'welcome'
    );
  END IF;

  -- Enable 2FA by default for all new users
  INSERT INTO public.user_2fa_settings (user_id, is_enabled, email_verified)
  VALUES (NEW.id, true, false);
  
  RETURN NEW;
END;
$function$;