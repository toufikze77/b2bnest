-- Add user preferences columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN currency_code TEXT DEFAULT 'USD',
ADD COLUMN timezone TEXT DEFAULT 'UTC',
ADD COLUMN country_code TEXT DEFAULT 'US',
ADD COLUMN language_code TEXT DEFAULT 'en',
ADD COLUMN date_format TEXT DEFAULT 'MM/DD/YYYY',
ADD COLUMN time_format TEXT DEFAULT '12h';

-- Create an index for faster lookups
CREATE INDEX idx_profiles_user_settings ON public.profiles(id, currency_code, timezone);

-- Update the handle_new_user function to include default settings
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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