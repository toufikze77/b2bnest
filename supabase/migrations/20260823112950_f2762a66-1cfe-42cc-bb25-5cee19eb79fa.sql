-- 1. ADVERTISEMENTS: hide contact PII at column level
REVOKE ALL ON public.advertisements FROM anon, authenticated;
GRANT SELECT (id, user_id, title, description, category, subcategory, price, currency,
              website_url, image_urls, is_service, is_active, featured_until, view_count,
              created_at, updated_at)
  ON public.advertisements TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.advertisements TO authenticated;
GRANT ALL ON public.advertisements TO service_role;

-- 2. COMPANIES: authenticated-only directory
DROP POLICY IF EXISTS "Anyone can view companies" ON public.companies;
CREATE POLICY "Authenticated users can view companies"
  ON public.companies FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.companies FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;

-- 3. HMRC SETTINGS: encrypt client_secret at rest, block direct reads
CREATE OR REPLACE FUNCTION public.encrypt_hmrc_settings_secret()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.client_secret IS NOT NULL
     AND NEW.client_secret <> ''
     AND NEW.client_secret NOT LIKE 'ENC:%' THEN
    NEW.client_secret := public.encrypt_hmrc_token(NEW.client_secret);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS encrypt_hmrc_settings_secret_trigger ON public.hmrc_settings;
CREATE TRIGGER encrypt_hmrc_settings_secret_trigger
  BEFORE INSERT OR UPDATE ON public.hmrc_settings
  FOR EACH ROW EXECUTE FUNCTION public.encrypt_hmrc_settings_secret();

UPDATE public.hmrc_settings
  SET client_secret = public.encrypt_hmrc_token(client_secret)
  WHERE client_secret IS NOT NULL
    AND client_secret <> ''
    AND client_secret NOT LIKE 'ENC:%';

CREATE OR REPLACE FUNCTION public.get_hmrc_client_secret(p_user_id uuid DEFAULT auth.uid())
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_secret text;
BEGIN
  IF auth.uid() IS NULL OR p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  SELECT client_secret INTO v_secret
    FROM public.hmrc_settings
    WHERE user_id = p_user_id
    LIMIT 1;
  RETURN public.decrypt_hmrc_token(v_secret);
END;
$$;

REVOKE ALL ON public.hmrc_settings FROM anon, authenticated;
GRANT SELECT (id, user_id, company_name, company_number, utr, vat_number, paye_reference,
              client_id, redirect_uri, auto_submit_vat, email_notifications, reminder_days,
              sandbox_mode, created_at, updated_at)
  ON public.hmrc_settings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.hmrc_settings TO authenticated;
GRANT ALL ON public.hmrc_settings TO service_role;