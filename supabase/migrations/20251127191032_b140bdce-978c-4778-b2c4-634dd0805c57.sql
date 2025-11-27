-- Add AI credits tracking to subscribers table
ALTER TABLE public.subscribers 
ADD COLUMN IF NOT EXISTS ai_credits_remaining INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_credits_limit INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_credits_reset_date TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '1 month');

-- Update existing subscribers based on their tier
UPDATE public.subscribers
SET 
  ai_credits_limit = CASE 
    WHEN subscription_tier = 'free' THEN 10
    WHEN subscription_tier = 'Starter' THEN 250
    WHEN subscription_tier = 'Professional' THEN 1000
    WHEN subscription_tier = 'Enterprise' THEN 5000
    ELSE 10
  END,
  ai_credits_remaining = CASE 
    WHEN subscription_tier = 'free' THEN 10
    WHEN subscription_tier = 'Starter' THEN 250
    WHEN subscription_tier = 'Professional' THEN 1000
    WHEN subscription_tier = 'Enterprise' THEN 5000
    ELSE 10
  END
WHERE ai_credits_limit = 0 OR ai_credits_limit IS NULL;

-- Create function to check and deduct AI credits
CREATE OR REPLACE FUNCTION public.check_and_deduct_ai_credit(
  p_user_id UUID,
  p_credits_to_deduct INTEGER DEFAULT 1
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_subscriber RECORD;
  v_result JSON;
BEGIN
  -- Get current subscriber info with row lock
  SELECT * INTO v_subscriber
  FROM public.subscribers
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  -- If no subscriber record, create one with free tier
  IF NOT FOUND THEN
    INSERT INTO public.subscribers (user_id, email, subscribed, subscription_tier, ai_credits_limit, ai_credits_remaining)
    VALUES (
      p_user_id,
      (SELECT email FROM auth.users WHERE id = p_user_id),
      false,
      'free',
      10,
      10
    )
    RETURNING * INTO v_subscriber;
  END IF;
  
  -- Check if credits need to be reset (monthly)
  IF v_subscriber.ai_credits_reset_date <= NOW() THEN
    UPDATE public.subscribers
    SET 
      ai_credits_remaining = ai_credits_limit,
      ai_credits_reset_date = NOW() + interval '1 month'
    WHERE user_id = p_user_id
    RETURNING * INTO v_subscriber;
  END IF;
  
  -- Check if user has enough credits
  IF v_subscriber.ai_credits_remaining < p_credits_to_deduct THEN
    v_result := json_build_object(
      'success', false,
      'error', 'insufficient_credits',
      'credits_remaining', v_subscriber.ai_credits_remaining,
      'credits_limit', v_subscriber.ai_credits_limit,
      'reset_date', v_subscriber.ai_credits_reset_date,
      'subscription_tier', v_subscriber.subscription_tier
    );
    RETURN v_result;
  END IF;
  
  -- Deduct credits
  UPDATE public.subscribers
  SET ai_credits_remaining = ai_credits_remaining - p_credits_to_deduct
  WHERE user_id = p_user_id
  RETURNING 
    json_build_object(
      'success', true,
      'credits_remaining', ai_credits_remaining,
      'credits_limit', ai_credits_limit,
      'reset_date', ai_credits_reset_date,
      'subscription_tier', subscription_tier
    ) INTO v_result;
  
  RETURN v_result;
END;
$function$;

-- Create function to get AI credits info
CREATE OR REPLACE FUNCTION public.get_ai_credits_info(p_user_id UUID DEFAULT auth.uid())
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_subscriber RECORD;
BEGIN
  SELECT * INTO v_subscriber
  FROM public.subscribers
  WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'credits_remaining', 10,
      'credits_limit', 10,
      'reset_date', NOW() + interval '1 month',
      'subscription_tier', 'free'
    );
  END IF;
  
  -- Check if credits need to be reset
  IF v_subscriber.ai_credits_reset_date <= NOW() THEN
    UPDATE public.subscribers
    SET 
      ai_credits_remaining = ai_credits_limit,
      ai_credits_reset_date = NOW() + interval '1 month'
    WHERE user_id = p_user_id
    RETURNING * INTO v_subscriber;
  END IF;
  
  RETURN json_build_object(
    'credits_remaining', v_subscriber.ai_credits_remaining,
    'credits_limit', v_subscriber.ai_credits_limit,
    'reset_date', v_subscriber.ai_credits_reset_date,
    'subscription_tier', v_subscriber.subscription_tier
  );
END;
$function$;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_subscribers_user_credits ON public.subscribers(user_id, ai_credits_remaining);