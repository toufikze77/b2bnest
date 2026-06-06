
-- Restrict column-level SELECT on sensitive columns. Force read access through SECURITY DEFINER RPCs.

-- advertisements: contact info only via get_advertisement_contact_info()
REVOKE SELECT (contact_email, contact_phone) ON public.advertisements FROM authenticated, anon;

-- bank_accounts: account_number/sort_code only via get_bank_account_details()
REVOKE SELECT (account_number, sort_code) ON public.bank_accounts FROM authenticated, anon;

-- hmrc_integrations: tokens only via get_hmrc_tokens()
REVOKE SELECT (access_token, refresh_token) ON public.hmrc_integrations FROM authenticated, anon;

-- hmrc_settings: client_secret only via get_hmrc_client_secret()
REVOKE SELECT (client_secret) ON public.hmrc_settings FROM authenticated, anon;

-- user_integrations: oauth tokens only via get_integration_tokens()
REVOKE SELECT (access_token, refresh_token) ON public.user_integrations FROM authenticated, anon;

-- Harden organization_invitations token-lookup policy: require authenticated role
DROP POLICY IF EXISTS "Invitees can look up by token" ON public.organization_invitations;
CREATE POLICY "Invitees can look up by token"
  ON public.organization_invitations
  FOR SELECT
  TO authenticated
  USING (
    token IS NOT NULL
    AND token = current_setting('app.invitation_token', true)
  );

-- Tighten payments INSERT: require auth.uid() = user_id (prevents attributing payments to other users' emails)
DROP POLICY IF EXISTS "Users can create their own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can insert their own payments" ON public.payments;
CREATE POLICY "Users can insert their own payments"
  ON public.payments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
