
-- Restrict audit log inserts to service_role (SECURITY DEFINER functions still bypass RLS)
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
CREATE POLICY "Service role can insert audit logs"
  ON public.audit_logs FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "System can insert banking audit logs" ON public.banking_audit_logs;
CREATE POLICY "Service role can insert banking audit logs"
  ON public.banking_audit_logs FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "System can insert integration audit logs" ON public.integration_audit_logs;
CREATE POLICY "Service role can insert integration audit logs"
  ON public.integration_audit_logs FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "System can insert payment audit logs" ON public.payment_audit_logs;
CREATE POLICY "Service role can insert payment audit logs"
  ON public.payment_audit_logs FOR INSERT TO service_role WITH CHECK (true);

-- B2B form: route through edge function (service_role), drop anonymous public insert
DROP POLICY IF EXISTS "Anyone can submit B2B forms" ON public.b2b_form_submissions;
CREATE POLICY "Service role can insert B2B form submissions"
  ON public.b2b_form_submissions FOR INSERT TO service_role WITH CHECK (true);

-- Revoke direct column access to sensitive token/secret columns; force access via SECURITY DEFINER RPCs
REVOKE SELECT (access_token, refresh_token) ON public.hmrc_integrations FROM anon, authenticated, PUBLIC;
REVOKE SELECT (client_secret) ON public.hmrc_settings FROM anon, authenticated, PUBLIC;
REVOKE SELECT (access_token, refresh_token) ON public.user_integrations FROM anon, authenticated, PUBLIC;

-- Lock down 2FA codes: remove direct user SELECT; verification must go via edge function (service_role)
DROP POLICY IF EXISTS "Users can view only their own 2FA codes" ON public.user_2fa_codes;

-- project_time_entries: explicit owner fallback SELECT policy (for personal, non-org entries)
CREATE POLICY "Users can view their own time entries"
  ON public.project_time_entries FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
