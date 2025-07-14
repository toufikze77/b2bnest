-- Update RLS policy for user_2fa_codes to allow system insertions for 2FA
DROP POLICY IF EXISTS "Users can manage their own 2FA codes" ON public.user_2fa_codes;

-- Create separate policies for different operations
CREATE POLICY "System can insert 2FA codes" 
ON public.user_2fa_codes 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can view their own 2FA codes" 
ON public.user_2fa_codes 
FOR SELECT 
USING (auth.uid() = user_id::uuid OR user_id IS NULL);

CREATE POLICY "System can update 2FA codes" 
ON public.user_2fa_codes 
FOR UPDATE 
USING (true);