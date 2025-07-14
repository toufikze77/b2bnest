-- Allow null user_id in user_2fa_codes table for email verification codes
ALTER TABLE public.user_2fa_codes ALTER COLUMN user_id DROP NOT NULL;