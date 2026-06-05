
-- 1) security_audit_logs: only service_role can insert
DROP POLICY IF EXISTS "System can insert security audit logs" ON public.security_audit_logs;
CREATE POLICY "Service role can insert security audit logs"
ON public.security_audit_logs
FOR INSERT
TO service_role
WITH CHECK (true);

-- 2) user_2fa_codes: explicit deny for authenticated (defense in depth)
DROP POLICY IF EXISTS "Block authenticated direct access to 2FA codes" ON public.user_2fa_codes;
CREATE POLICY "Block authenticated direct access to 2FA codes"
ON public.user_2fa_codes
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- 3) advertisements: hide contact_email / contact_phone from broad authenticated SELECT.
-- Access these only through public.get_advertisement_contact_info(ad_id) security-definer function.
REVOKE SELECT (contact_email, contact_phone) ON public.advertisements FROM authenticated;
REVOKE SELECT (contact_email, contact_phone) ON public.advertisements FROM anon;
GRANT SELECT (contact_email, contact_phone) ON public.advertisements TO service_role;
