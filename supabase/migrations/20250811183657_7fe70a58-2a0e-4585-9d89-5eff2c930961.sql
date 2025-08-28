-- Fix critical 2FA security vulnerability - block public access to 2FA codes
-- This prevents anyone from reading active 2FA verification codes

-- Drop the existing overly permissive policies
DROP POLICY IF EXISTS "System can insert 2FA codes" ON public.user_2fa_codes;
DROP POLICY IF EXISTS "System can update 2FA codes" ON public.user_2fa_codes;
DROP POLICY IF EXISTS "Users can view their own 2FA codes" ON public.user_2fa_codes;

-- Create strict policies that prevent public access

-- Block ALL anonymous access to 2FA codes (critical security measure)
CREATE POLICY "Block anonymous access to 2FA codes"
ON public.user_2fa_codes
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Allow service role to manage 2FA codes for system operations
CREATE POLICY "System can manage 2FA codes"
ON public.user_2fa_codes
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Allow authenticated users to view ONLY their own 2FA codes
CREATE POLICY "Users can view only their own 2FA codes"
ON public.user_2fa_codes
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Prevent users from inserting, updating, or deleting 2FA codes
-- Only the system should manage these operations for security
-- (This ensures users cannot tamper with 2FA codes)