-- Add trial tracking to profiles table
ALTER TABLE public.profiles 
ADD COLUMN trial_started_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
ADD COLUMN is_trial_active BOOLEAN DEFAULT true,
ADD COLUMN trial_expired BOOLEAN DEFAULT false;

-- Create function to check and update trial status
CREATE OR REPLACE FUNCTION public.check_trial_status(user_id_param UUID)
RETURNS TABLE(
  is_trial_active BOOLEAN,
  trial_expired BOOLEAN,
  days_remaining INTEGER,
  trial_ends_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  profile_record RECORD;
  days_left INTEGER;
BEGIN
  -- Get profile data
  SELECT * INTO profile_record 
  FROM public.profiles 
  WHERE id = user_id_param;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Calculate days remaining
  days_left := EXTRACT(DAY FROM (profile_record.trial_ends_at - NOW()));
  
  -- Update trial status if expired
  IF NOW() > profile_record.trial_ends_at AND profile_record.is_trial_active THEN
    UPDATE public.profiles 
    SET is_trial_active = false, trial_expired = true
    WHERE id = user_id_param;
    
    profile_record.is_trial_active := false;
    profile_record.trial_expired := true;
  END IF;
  
  RETURN QUERY SELECT 
    profile_record.is_trial_active,
    profile_record.trial_expired,
    GREATEST(0, days_left),
    profile_record.trial_ends_at;
END;
$$;

-- Update existing users to have trial data
UPDATE public.profiles 
SET 
  trial_started_at = created_at,
  trial_ends_at = created_at + INTERVAL '14 days',
  is_trial_active = true,
  trial_expired = false
WHERE trial_started_at IS NULL;