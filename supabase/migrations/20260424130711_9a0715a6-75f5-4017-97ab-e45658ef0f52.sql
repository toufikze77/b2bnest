-- 1) user_2fa_attempts: replace permissive ALL policy with service-role-only management
DROP POLICY IF EXISTS "System can manage 2FA attempts" ON public.user_2fa_attempts;

CREATE POLICY "Service role can manage 2FA attempts"
ON public.user_2fa_attempts
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 2) user_roles: add explicit INSERT/UPDATE/DELETE policies with WITH CHECK to prevent privilege escalation
DROP POLICY IF EXISTS "Only owners can manage roles" ON public.user_roles;

CREATE POLICY "Owners can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Owners can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'owner'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Owners can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'owner'::app_role));

-- 3) hmrc_settings: prevent reading client_secret via column-level revoke
-- Revoke broad column SELECT from authenticated, then re-grant on safe columns only
REVOKE SELECT ON public.hmrc_settings FROM authenticated;
REVOKE SELECT ON public.hmrc_settings FROM anon;

GRANT SELECT (
  id, user_id, organization_id, client_id, redirect_uri,
  company_name, company_number, vat_number, utr, paye_reference,
  sandbox_mode, auto_submit_vat, email_notifications, reminder_days,
  created_at, updated_at
) ON public.hmrc_settings TO authenticated;

-- Service role retains full access (needed by edge functions for OAuth exchange)
GRANT SELECT ON public.hmrc_settings TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.hmrc_settings TO authenticated;