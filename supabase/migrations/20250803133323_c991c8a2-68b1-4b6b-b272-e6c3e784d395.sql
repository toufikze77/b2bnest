-- Update profiles table to ensure we have necessary fields for user assignment
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS display_name TEXT,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Update the handle_new_user function to set display_name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
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
$function$;

-- Create RLS policy for profiles to allow users to see other active users for assignment
CREATE POLICY "Users can view active profiles for assignment" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (is_active = true);