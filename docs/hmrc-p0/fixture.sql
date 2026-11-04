-- HMRC P0 test fixture (DISPOSABLE local Postgres only). Runs after the shim and the Phase 35 / 36 / 37 / 31 fixtures
-- (docs/hmrc-p0/run-test.sh). Adds the HMRC tables, policies, grants, triggers and functions exactly as production
-- (read-only, 4 Nov 2026: columns, constraints, policies, table and column grants, function bodies hash-checked by the
-- runner). Production's PostgreSQL also has the MAINTAIN privilege (PG17); this PG16 fixture leaves it out.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'owner';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name text;

CREATE OR REPLACE FUNCTION public.is_admin_or_owner(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('owner'::public.app_role, 'admin'::public.app_role)
  )
$function$;

CREATE TABLE public.hmrc_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  access_token text NOT NULL, refresh_token text, expires_at timestamptz, token_type text DEFAULT 'Bearer', scope text,
  is_connected boolean DEFAULT true, connected_at timestamptz DEFAULT now(), last_refreshed_at timestamptz,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, organization_id)
);
CREATE TABLE public.hmrc_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  company_name text, company_number text, utr text, vat_number text, paye_reference text,
  client_id text NOT NULL, client_secret text NOT NULL, redirect_uri text NOT NULL,
  auto_submit_vat boolean DEFAULT false, email_notifications boolean DEFAULT true, reminder_days integer DEFAULT 7,
  sandbox_mode boolean DEFAULT true, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, organization_id)
);
CREATE TABLE public.hmrc_submission_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  submission_type text NOT NULL, submission_id text, period text, status text NOT NULL DEFAULT 'pending',
  request_payload jsonb, response_data jsonb, error_message text,
  submitted_at timestamptz DEFAULT now(), created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.hmrc_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hmrc_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hmrc_submission_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can delete their own HMRC integrations" ON public.hmrc_integrations FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own HMRC integrations" ON public.hmrc_integrations FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id) AND ((organization_id IS NULL) OR public.user_is_organization_member(organization_id, auth.uid())));
CREATE POLICY "Users can update their own HMRC integrations" ON public.hmrc_integrations FOR UPDATE TO authenticated USING (auth.uid() = user_id)
  WITH CHECK ((auth.uid() = user_id) AND ((organization_id IS NULL) OR public.user_is_organization_member(organization_id, auth.uid())));
CREATE POLICY "Users can view their own HMRC integrations" ON public.hmrc_integrations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY require_aal2_if_enrolled ON public.hmrc_integrations AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY "Users can delete their own HMRC settings" ON public.hmrc_settings FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own HMRC settings" ON public.hmrc_settings FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id) AND ((organization_id IS NULL) OR public.user_is_organization_member(organization_id, auth.uid())));
CREATE POLICY "Users can update their own HMRC settings" ON public.hmrc_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id)
  WITH CHECK ((auth.uid() = user_id) AND ((organization_id IS NULL) OR public.user_is_organization_member(organization_id, auth.uid())));
CREATE POLICY "Users can view their own HMRC settings" ON public.hmrc_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY require_aal2_if_enrolled ON public.hmrc_settings AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY "Admins can view all HMRC submission logs" ON public.hmrc_submission_logs FOR SELECT USING (public.is_admin_or_owner(auth.uid()));
CREATE POLICY "Users can insert their own HMRC submission logs" ON public.hmrc_submission_logs FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id) AND ((organization_id IS NULL) OR public.user_is_organization_member(organization_id, auth.uid())));
CREATE POLICY "Users can view their own HMRC submission logs" ON public.hmrc_submission_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY require_aal2_if_enrolled ON public.hmrc_submission_logs AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));

-- Production grants (table and column level), without PG17's MAINTAIN.
REVOKE ALL ON public.hmrc_integrations, public.hmrc_settings, public.hmrc_submission_logs FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.hmrc_integrations, public.hmrc_settings, public.hmrc_submission_logs TO service_role;
GRANT INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.hmrc_integrations TO authenticated;
GRANT SELECT (id, user_id, organization_id, expires_at, token_type, scope, is_connected, connected_at, last_refreshed_at, created_at, updated_at)
  ON public.hmrc_integrations TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.hmrc_settings TO authenticated;
GRANT SELECT (id, user_id, company_name, company_number, utr, vat_number, paye_reference, client_id, redirect_uri, auto_submit_vat,
  email_notifications, reminder_days, sandbox_mode, created_at, updated_at) ON public.hmrc_settings TO authenticated;
GRANT SELECT ON public.hmrc_submission_logs TO anon;
GRANT ALL ON public.hmrc_submission_logs TO authenticated;

CREATE OR REPLACE FUNCTION public.update_hmrc_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.encrypt_hmrc_token(token text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF token IS NULL OR token = '' THEN
    RETURN NULL;
  END IF;
  RETURN 'ENC:' || encode(convert_to(token, 'UTF8'), 'base64');
END;
$function$;
CREATE OR REPLACE FUNCTION public.decrypt_hmrc_token(encrypted_token text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  decrypted_token TEXT;
BEGIN
  IF encrypted_token IS NULL OR encrypted_token = '' THEN
    RETURN NULL;
  END IF;
  
  IF encrypted_token LIKE 'ENC:%' THEN
    BEGIN
      decrypted_token := convert_from(decode(substring(encrypted_token from 5), 'base64'), 'UTF8');
    EXCEPTION WHEN OTHERS THEN
      RETURN NULL;
    END;
  ELSE
    decrypted_token := encrypted_token;
  END IF;
  
  RETURN decrypted_token;
END;
$function$;
CREATE OR REPLACE FUNCTION public.encrypt_hmrc_settings_secret()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.client_secret IS NOT NULL
     AND NEW.client_secret <> ''
     AND NEW.client_secret NOT LIKE 'ENC:%' THEN
    NEW.client_secret := public.encrypt_hmrc_token(NEW.client_secret);
  END IF;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.get_hmrc_client_secret(p_user_id uuid DEFAULT auth.uid())
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_secret text;
begin
  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard
  perform public.assert_self(p_user_id);
  select client_secret into v_secret from public.hmrc_settings where user_id = p_user_id limit 1;
  return public.decrypt_hmrc_token(v_secret);
end;
$function$;
CREATE OR REPLACE FUNCTION public.get_hmrc_tokens(p_user_id uuid DEFAULT auth.uid())
 RETURNS TABLE(access_token text, refresh_token text, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard
  perform public.assert_self(p_user_id);
  return query
    select public.decrypt_hmrc_token(h.access_token),
           public.decrypt_hmrc_token(h.refresh_token),
           h.expires_at
    from public.hmrc_integrations h
    where h.user_id = p_user_id and h.is_connected = true
    order by h.connected_at desc nulls last;
end;
$function$;
REVOKE ALL ON FUNCTION public.update_hmrc_updated_at(), public.encrypt_hmrc_token(text), public.decrypt_hmrc_token(text),
  public.encrypt_hmrc_settings_secret(), public.get_hmrc_client_secret(uuid), public.get_hmrc_tokens(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_hmrc_updated_at(), public.encrypt_hmrc_token(text), public.decrypt_hmrc_token(text),
  public.encrypt_hmrc_settings_secret(), public.get_hmrc_client_secret(uuid), public.get_hmrc_tokens(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_hmrc_client_secret(uuid), public.get_hmrc_tokens(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.is_admin_or_owner(uuid) FROM PUBLIC, anon;

CREATE TRIGGER update_hmrc_integrations_updated_at BEFORE UPDATE ON public.hmrc_integrations FOR EACH ROW EXECUTE FUNCTION public.update_hmrc_updated_at();
CREATE TRIGGER update_hmrc_settings_updated_at BEFORE UPDATE ON public.hmrc_settings FOR EACH ROW EXECUTE FUNCTION public.update_hmrc_updated_at();
CREATE TRIGGER update_hmrc_submission_logs_updated_at BEFORE UPDATE ON public.hmrc_submission_logs FOR EACH ROW EXECUTE FUNCTION public.update_hmrc_updated_at();
CREATE TRIGGER encrypt_hmrc_settings_secret_trigger BEFORE INSERT OR UPDATE ON public.hmrc_settings FOR EACH ROW EXECUTE FUNCTION public.encrypt_hmrc_settings_secret();

INSERT INTO public.phase25_mfa_guard_log (fn, kind, old_md5, new_md5) VALUES
  ('public.get_hmrc_client_secret(uuid)', 'user', '403c818389211da9a1ea33bc128e1385', 'eba34f6298f5594e2cf160e12548c6e4'),
  ('public.get_hmrc_tokens(uuid)', 'user', '4867b5d3a4916a132a0a856da02d3dd1', '5532c89e3e0c944bca121522b6dbbc06');

-- Production has one hmrc_settings row (sandbox) and no integrations or logs. The same here, for a test user.
INSERT INTO auth.users (id, email) VALUES ('a0000000-0000-4000-8000-0000000000ff', 'settings-owner@example.test');
INSERT INTO public.hmrc_settings (user_id, company_name, client_id, client_secret, redirect_uri, sandbox_mode)
VALUES ('a0000000-0000-4000-8000-0000000000ff', 'Test Ltd', 'test-client-id', 'test-not-a-real-secret', 'https://example.test/cb', true);
