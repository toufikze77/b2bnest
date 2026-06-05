-- Revoke direct SELECT on HMRC sensitive columns; access only via SECURITY DEFINER RPCs
REVOKE SELECT (access_token, refresh_token) ON public.hmrc_integrations FROM anon, authenticated;
REVOKE SELECT (client_secret) ON public.hmrc_settings FROM anon, authenticated;

-- Restrict contact_email / contact_phone on advertisements; use get_advertisement_contact_info() to read them
REVOKE SELECT (contact_email, contact_phone) ON public.advertisements FROM anon, authenticated;