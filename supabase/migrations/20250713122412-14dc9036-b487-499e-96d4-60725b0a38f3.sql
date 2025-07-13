-- Create table for storing user 2FA settings and temporary codes
CREATE TABLE public.user_2fa_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  backup_codes TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_2fa_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for user 2FA settings
CREATE POLICY "Users can manage their own 2FA settings" 
ON public.user_2fa_settings 
FOR ALL 
USING (auth.uid() = user_id);

-- Create table for temporary 2FA codes
CREATE TABLE public.user_2fa_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  code TEXT NOT NULL,
  code_type TEXT NOT NULL, -- 'login', 'password_reset'
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '10 minutes'),
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_2fa_codes ENABLE ROW LEVEL SECURITY;

-- Create policies for user 2FA codes
CREATE POLICY "Users can manage their own 2FA codes" 
ON public.user_2fa_codes 
FOR ALL 
USING (auth.uid() = user_id);

-- Create function to clean up expired codes
CREATE OR REPLACE FUNCTION public.cleanup_expired_2fa_codes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.user_2fa_codes 
  WHERE expires_at < now() OR used = true;
END;
$$;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_2fa_settings_updated_at
BEFORE UPDATE ON public.user_2fa_settings
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();