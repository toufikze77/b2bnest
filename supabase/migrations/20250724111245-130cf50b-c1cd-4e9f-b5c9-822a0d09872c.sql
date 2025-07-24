-- Add rate limiting table for 2FA attempts
CREATE TABLE IF NOT EXISTS public.user_2fa_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email text UNIQUE,
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