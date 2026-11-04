-- =====================================================================================================================
-- HMRC P0: a secure, server-side HMRC connection per company (sandbox first). PREPARED, NOT APPLIED.
--
-- ORDER (docs/hmrc-p0/README.md): 1 the owner applies this; 2 sets the five Edge Function secrets; 3 adds the redirect
-- URL to the HMRC Developer Hub application; 4 deploys hmrc-connect-start / hmrc-connect-complete / hmrc-disconnect;
-- 5 publishes the frontend.
--
-- What it does (one transaction; any check failing changes nothing):
--   * public.hmrc_connections: one row per company and environment. Tokens are AES-256-GCM ciphertext made by the Edge
--     Functions with a key the database never sees ("v1.<key id>.<iv>.<ciphertext>"). No client can read or write it;
--     the browser reads status only through hmrc_connection_status(), which returns no token.
--   * public.hmrc_oauth_states: single-use, 10-minute sign-in states (only a SHA-256 hash is stored). Service role only.
--   * public.hmrc_audit_log: append-only (no UPDATE / DELETE / TRUNCATE for anyone, enforced by triggers); event codes
--     only, never a token, code, secret or HMRC response body. Owners and admins read their company's rows through
--     hmrc_audit_events().
--   * hmrc_manage_allowed(company, user) (service role only) is the one rule for "may manage HMRC for this company":
--     an active owner or admin of the company (user_is_organization_admin), and an account that is in its trial or
--     paid (not trial_ended, not suspended: _access_state_for). Platform roles (super admin, master access) grant
--     nothing here.
--   * Closes the old holes: drops get_hmrc_tokens and get_hmrc_client_secret (they returned decoded tokens and the
--     client secret to the browser), the base64 encrypt_hmrc_token / decrypt_hmrc_token and the settings trigger that
--     used them; removes every client privilege on hmrc_integrations; clears and blocks the per-user client_id /
--     client_secret / redirect_uri columns of hmrc_settings (the business details stay editable).
--
-- Production facts this was written against (read-only, 4 Nov 2026): 1 hmrc_settings row (sandbox_mode true),
-- 0 hmrc_integrations rows, 0 hmrc_submission_logs rows; md5(prosrc) get_hmrc_tokens 5532c89e…, get_hmrc_client_secret
-- eba34f62…, encrypt_hmrc_token 744c7dca…, decrypt_hmrc_token eec73118…, encrypt_hmrc_settings_secret be10b346…,
-- _access_state_for 292e158f…, mfa_ok 20516f2e…, require_aal2_if_enrolled 10b2ae7b…, user_is_organization_admin
-- c6dd6285…, user_is_organization_member 1fb55538…. Anything else: refused.
-- Rollback: docs/hmrc-p0/rollback.sql. Tests: docs/hmrc-p0/run-test.sh.
-- =====================================================================================================================
BEGIN;

DO $$
DECLARE r record;
BEGIN
  IF to_regclass('public.hmrc_connections') IS NOT NULL OR to_regclass('public.hmrc_p0_backup') IS NOT NULL THEN
    RAISE EXCEPTION 'HMRC P0 already exists (applied twice?)';
  END IF;
  IF to_regclass('public.hmrc_oauth_states') IS NOT NULL OR to_regclass('public.hmrc_audit_log') IS NOT NULL
     OR to_regclass('public.phase25_mfa_guard_log') IS NULL OR to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'unexpected tables: an HMRC P0 table name is taken, or Phase 25 / organizations is missing';
  END IF;
  FOR r IN SELECT * FROM (VALUES
      ('public.get_hmrc_tokens(uuid)', '5532c89e3e0c944bca121522b6dbbc06'),
      ('public.get_hmrc_client_secret(uuid)', 'eba34f6298f5594e2cf160e12548c6e4'),
      ('public.encrypt_hmrc_token(text)', '744c7dca6d8cabbef4d95e58f4fb09f5'),
      ('public.decrypt_hmrc_token(text)', 'eec73118249cabf4f41722c379db680b'),
      ('public.encrypt_hmrc_settings_secret()', 'be10b3464a317741e4ffcb1dfe0aaf8a'),
      ('public._access_state_for(uuid)', '292e158f87569a1b7bdbe32e64da0a67'),
      ('public.mfa_ok()', '20516f2ec203220b3ac08d1230c7c306'),
      ('public.require_aal2_if_enrolled()', '10b2ae7bd2f9a94ea20598f19b8aebf2'),
      ('public.user_is_organization_admin(uuid,uuid)', 'c6dd628541413ec82565a6676a55a767'),
      ('public.user_is_organization_member(uuid,uuid)', '1fb55538d44b2451875f8baf1b6e4388')) v(fn, h) LOOP
    IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure(r.fn)) IS DISTINCT FROM r.h THEN
      RAISE EXCEPTION '% differs from the production body this was written against', r.fn;
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM public.hmrc_settings) <> 1 OR (SELECT count(*) FROM public.hmrc_settings WHERE sandbox_mode) <> 1
     OR (SELECT count(*) FROM public.hmrc_integrations) <> 0 OR (SELECT count(*) FROM public.hmrc_submission_logs) <> 0 THEN
    RAISE EXCEPTION 'HMRC data differs from what was read (expected 1 sandbox hmrc_settings row, 0 integrations, 0 logs): stop and re-read';
  END IF;
  IF (SELECT string_agg(column_name || ':' || is_nullable, ',' ORDER BY column_name) FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'hmrc_settings' AND column_name IN ('client_id', 'client_secret', 'redirect_uri'))
     IS DISTINCT FROM 'client_id:NO,client_secret:NO,redirect_uri:NO' THEN
    RAISE EXCEPTION 'hmrc_settings credential columns differ from production';
  END IF;
  IF has_column_privilege('authenticated', 'public.hmrc_integrations', 'access_token', 'SELECT')
     OR has_column_privilege('authenticated', 'public.hmrc_settings', 'client_secret', 'SELECT')
     OR NOT has_function_privilege('authenticated', 'public.get_hmrc_tokens(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'HMRC privileges differ from production';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public'
              AND p.proname IN ('hmrc_manage_allowed', 'hmrc_can_manage', 'hmrc_connection_status', 'hmrc_audit_events',
                                'hmrc_consume_state', 'hmrc_claim_refresh', '_hmrc_audit_append_only', '_hmrc_touch')) THEN
    RAISE EXCEPTION 'an HMRC P0 function name is already taken';
  END IF;
  IF (SELECT count(*) FROM public.phase25_mfa_guard_log WHERE fn IN ('public.get_hmrc_tokens(uuid)', 'public.get_hmrc_client_secret(uuid)')) <> 2 THEN
    RAISE EXCEPTION 'Phase 25 guard log rows for the old HMRC functions are missing';
  END IF;
END $$;

-- 0. Backup for the rollback: the old function definitions and privileges, the trigger, the guard log rows and the
--    anon / authenticated / PUBLIC grants on hmrc_integrations and hmrc_settings. No secret is copied (the one
--    hmrc_settings row's credential columns are cleared below and NOT kept; see the README).
CREATE TABLE public.hmrc_p0_backup (kind text NOT NULL, name text NOT NULL, def text, acl text, PRIMARY KEY (kind, name));
ALTER TABLE public.hmrc_p0_backup ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hmrc_p0_backup FROM PUBLIC, anon, authenticated;
INSERT INTO public.hmrc_p0_backup (kind, name, def, acl)
SELECT 'function', 'public.' || p.oid::regprocedure::text, pg_get_functiondef(p.oid), p.proacl::text FROM pg_proc p
 WHERE p.oid IN ('public.get_hmrc_tokens(uuid)'::regprocedure, 'public.get_hmrc_client_secret(uuid)'::regprocedure,
                 'public.encrypt_hmrc_token(text)'::regprocedure, 'public.decrypt_hmrc_token(text)'::regprocedure,
                 'public.encrypt_hmrc_settings_secret()'::regprocedure);
INSERT INTO public.hmrc_p0_backup (kind, name, def)
SELECT 'trigger', t.tgname, pg_get_triggerdef(t.oid) FROM pg_trigger t
 WHERE t.tgrelid = 'public.hmrc_settings'::regclass AND t.tgname = 'encrypt_hmrc_settings_secret_trigger';
INSERT INTO public.hmrc_p0_backup (kind, name, def)
SELECT 'guard', g.fn, row_to_json(g)::text FROM public.phase25_mfa_guard_log g
 WHERE g.fn IN ('public.get_hmrc_tokens(uuid)', 'public.get_hmrc_client_secret(uuid)');
INSERT INTO public.hmrc_p0_backup (kind, name, acl)
SELECT 'table', 'public.' || c.relname, c.relacl::text FROM pg_class c WHERE c.oid IN ('public.hmrc_integrations'::regclass, 'public.hmrc_settings'::regclass);
INSERT INTO public.hmrc_p0_backup (kind, name, acl)
SELECT 'column', 'public.' || a.attrelid::regclass::text || '.' || a.attname, a.attacl::text FROM pg_attribute a
 WHERE a.attrelid IN ('public.hmrc_integrations'::regclass, 'public.hmrc_settings'::regclass) AND a.attnum > 0 AND NOT a.attisdropped AND a.attacl IS NOT NULL;

-- 1. Close the old holes.
DROP TRIGGER encrypt_hmrc_settings_secret_trigger ON public.hmrc_settings;
DROP FUNCTION public.get_hmrc_tokens(uuid);
DROP FUNCTION public.get_hmrc_client_secret(uuid);
DROP FUNCTION public.encrypt_hmrc_settings_secret();
DROP FUNCTION public.encrypt_hmrc_token(text);
DROP FUNCTION public.decrypt_hmrc_token(text);
DELETE FROM public.phase25_mfa_guard_log WHERE fn IN ('public.get_hmrc_tokens(uuid)', 'public.get_hmrc_client_secret(uuid)');

-- hmrc_integrations (0 rows, replaced by hmrc_connections): no client access at all.
REVOKE ALL ON public.hmrc_integrations FROM PUBLIC, anon, authenticated;
DO $$
DECLARE c text;
BEGIN
  FOR c IN SELECT attname FROM pg_attribute WHERE attrelid = 'public.hmrc_integrations'::regclass AND attnum > 0 AND NOT attisdropped LOOP
    EXECUTE format('REVOKE ALL (%I) ON public.hmrc_integrations FROM PUBLIC, anon, authenticated', c);
  END LOOP;
END $$;

-- hmrc_settings: the per-user HMRC application credentials are gone for good (one B2BNEST application, server secrets).
-- The business details (company name and number, UTR, VAT number, PAYE reference) stay the user's own to edit.
ALTER TABLE public.hmrc_settings ALTER COLUMN client_id DROP NOT NULL, ALTER COLUMN client_secret DROP NOT NULL, ALTER COLUMN redirect_uri DROP NOT NULL;
UPDATE public.hmrc_settings SET client_id = NULL, client_secret = NULL, redirect_uri = NULL;
ALTER TABLE public.hmrc_settings ADD CONSTRAINT hmrc_settings_no_credentials CHECK (client_id IS NULL AND client_secret IS NULL AND redirect_uri IS NULL);
REVOKE INSERT, UPDATE ON public.hmrc_settings FROM authenticated;
DO $$
DECLARE c text;
BEGIN
  FOR c IN SELECT attname FROM pg_attribute WHERE attrelid = 'public.hmrc_settings'::regclass AND attnum > 0 AND NOT attisdropped LOOP
    EXECUTE format('REVOKE ALL (%I) ON public.hmrc_settings FROM PUBLIC, anon, authenticated', c);
  END LOOP;
END $$;
GRANT SELECT (id, user_id, organization_id, company_name, company_number, utr, vat_number, paye_reference, created_at, updated_at) ON public.hmrc_settings TO authenticated;
GRANT INSERT (user_id, organization_id, company_name, company_number, utr, vat_number, paye_reference) ON public.hmrc_settings TO authenticated;
GRANT UPDATE (company_name, company_number, utr, vat_number, paye_reference) ON public.hmrc_settings TO authenticated;

-- 2. The new tables.
CREATE FUNCTION public._hmrc_touch()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

CREATE TABLE public.hmrc_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  environment text NOT NULL CONSTRAINT hc_environment CHECK (environment IN ('sandbox', 'production')),
  connected_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  access_token_enc text CONSTRAINT hc_access_format CHECK (access_token_enc ~ '^v1\.[A-Za-z0-9_-]{1,32}\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22,}$'),
  refresh_token_enc text CONSTRAINT hc_refresh_format CHECK (refresh_token_enc ~ '^v1\.[A-Za-z0-9_-]{1,32}\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22,}$'),
  expires_at timestamptz,
  scopes text[] NOT NULL DEFAULT '{}',
  status text NOT NULL CONSTRAINT hc_status CHECK (status IN ('connected', 'needs_reconnect', 'disconnected')),
  connected_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  refresh_lock_until timestamptz,
  CONSTRAINT hc_one_per_company UNIQUE (company_id, environment),
  CONSTRAINT hc_connected_has_token CHECK (status <> 'connected' OR access_token_enc IS NOT NULL),
  CONSTRAINT hc_disconnected_no_tokens CHECK (status <> 'disconnected' OR (access_token_enc IS NULL AND refresh_token_enc IS NULL))
);
COMMENT ON TABLE public.hmrc_connections IS 'HMRC P0: one HMRC connection per company and environment. Tokens are AES-256-GCM ciphertext made by the Edge Functions (key never in the database). Service role only.';
CREATE TRIGGER hmrc_connections_touch BEFORE INSERT OR UPDATE ON public.hmrc_connections FOR EACH ROW EXECUTE FUNCTION public._hmrc_touch();

CREATE TABLE public.hmrc_oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_hash text NOT NULL UNIQUE CONSTRAINT hos_hash CHECK (state_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  environment text NOT NULL CONSTRAINT hos_environment CHECK (environment IN ('sandbox', 'production')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '10 minutes',
  used_at timestamptz,
  CONSTRAINT hos_ten_minutes CHECK (expires_at > created_at AND expires_at <= created_at + interval '10 minutes')
);
COMMENT ON TABLE public.hmrc_oauth_states IS 'HMRC P0: single-use, 10-minute HMRC sign-in states (SHA-256 hash only). Service role only.';

CREATE TABLE public.hmrc_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id uuid NOT NULL,
  user_id uuid,
  environment text CONSTRAINT hal_environment CHECK (environment IN ('sandbox', 'production')),
  event text NOT NULL CONSTRAINT hal_event CHECK (event IN ('connect_started', 'connected', 'refreshed', 'refresh_failed', 'disconnected', 'refused')),
  reason text CONSTRAINT hal_reason CHECK (reason ~ '^[a-z0-9_]{1,60}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.hmrc_audit_log IS 'HMRC P0: append-only record of HMRC connection events (codes only, never a token, code, secret or HMRC response). No foreign keys on purpose: it outlives the company and the user.';

CREATE FUNCTION public._hmrc_audit_append_only()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'HMRC_AUDIT_APPEND_ONLY' USING ERRCODE = '42501', HINT = 'The HMRC audit log can only be added to.';
END;
$function$;
CREATE TRIGGER hmrc_audit_log_insert BEFORE INSERT ON public.hmrc_audit_log FOR EACH ROW EXECUTE FUNCTION public._hmrc_audit_append_only();
CREATE TRIGGER hmrc_audit_log_no_change BEFORE UPDATE OR DELETE ON public.hmrc_audit_log FOR EACH ROW EXECUTE FUNCTION public._hmrc_audit_append_only();
CREATE TRIGGER hmrc_audit_log_no_truncate BEFORE TRUNCATE ON public.hmrc_audit_log FOR EACH STATEMENT EXECUTE FUNCTION public._hmrc_audit_append_only();
REVOKE ALL ON FUNCTION public._hmrc_touch(), public._hmrc_audit_append_only() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['hmrc_connections', 'hmrc_oauth_states', 'hmrc_audit_log'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY require_aal2_if_enrolled ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()))', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
  END LOOP;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hmrc_connections, public.hmrc_oauth_states TO service_role;
GRANT SELECT, INSERT ON public.hmrc_audit_log TO service_role;
REVOKE UPDATE, DELETE, TRUNCATE ON public.hmrc_audit_log FROM service_role;

-- 3. The access rule (service role; used by the Edge Functions and by the functions below).
CREATE FUNCTION public.hmrc_manage_allowed(p_company uuid, p_user uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
DECLARE v_state text;
BEGIN
  IF p_user IS NULL THEN RETURN 'not_signed_in'; END IF;
  IF p_company IS NULL OR NOT public.user_is_organization_member(p_company, p_user) THEN RETURN 'not_member'; END IF;
  SELECT s.state INTO v_state FROM public._access_state_for(p_user) s;
  IF v_state = 'suspended' THEN RETURN 'suspended'; END IF;
  IF v_state = 'trial_ended' OR v_state IS NULL THEN RETURN 'trial_ended'; END IF;
  IF NOT public.user_is_organization_admin(p_company, p_user) THEN RETURN 'not_admin'; END IF;
  RETURN 'ok';
END;
$function$;

-- Single-use state: consumed atomically (unused, unexpired, same user).
CREATE FUNCTION public.hmrc_consume_state(p_state_hash text, p_user uuid)
 RETURNS TABLE(company_id uuid, environment text)
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  UPDATE public.hmrc_oauth_states s SET used_at = now()
   WHERE s.state_hash = p_state_hash AND s.user_id = p_user AND s.used_at IS NULL AND s.expires_at > now()
  RETURNING s.company_id, s.environment;
$function$;

-- Per-company refresh lock: true for exactly one caller at a time.
CREATE FUNCTION public.hmrc_claim_refresh(p_company uuid, p_environment text, p_seconds integer DEFAULT 30)
 RETURNS boolean
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  WITH claimed AS (
    UPDATE public.hmrc_connections c SET refresh_lock_until = now() + make_interval(secs => least(greatest(p_seconds, 5), 120))
     WHERE c.company_id = p_company AND c.environment = p_environment AND c.status = 'connected'
       AND (c.refresh_lock_until IS NULL OR c.refresh_lock_until < now())
    RETURNING 1)
  SELECT EXISTS (SELECT 1 FROM claimed);
$function$;
REVOKE ALL ON FUNCTION public.hmrc_manage_allowed(uuid, uuid), public.hmrc_consume_state(text, uuid), public.hmrc_claim_refresh(uuid, text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hmrc_manage_allowed(uuid, uuid), public.hmrc_consume_state(text, uuid), public.hmrc_claim_refresh(uuid, text, integer) TO service_role;

-- 4. What the browser may call (authenticated, Phase 25 guard).
CREATE FUNCTION public.hmrc_can_manage(p_company uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard
  RETURN public.hmrc_manage_allowed(p_company, auth.uid()) = 'ok';
END;
$function$;

-- Status for any active member of the company: never a token. Not a member (including platform admins who are not
-- members): HMRC_NOT_ALLOWED, nothing revealed. Trial ended / suspended: only that reason.
CREATE FUNCTION public.hmrc_connection_status(p_company uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_rule text;
BEGIN
  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard
  v_rule := public.hmrc_manage_allowed(p_company, auth.uid());
  IF v_rule IN ('not_signed_in', 'not_member') THEN
    RAISE EXCEPTION 'HMRC_NOT_ALLOWED' USING ERRCODE = '42501';
  END IF;
  IF v_rule IN ('trial_ended', 'suspended') THEN
    RETURN json_build_object('access', v_rule, 'can_manage', false, 'connections', '[]'::json);
  END IF;
  RETURN json_build_object(
    'access', 'ok',
    'can_manage', v_rule = 'ok',
    'connections', COALESCE((
      SELECT json_agg(json_build_object(
               'environment', c.environment,
               'status', c.status,
               'connected_by_name', COALESCE(NULLIF(btrim(p.display_name), ''), NULLIF(btrim(p.full_name), '')),
               'connected_at', c.connected_at,
               'expires_at', c.expires_at,
               'needs_reconnect', c.status = 'needs_reconnect',
               'scopes', c.scopes,
               'updated_at', c.updated_at) ORDER BY c.environment)
        FROM public.hmrc_connections c LEFT JOIN public.profiles p ON p.id = c.connected_by
       WHERE c.company_id = p_company), '[]'::json));
END;
$function$;

-- The company's HMRC audit trail, for its owners and admins only.
CREATE FUNCTION public.hmrc_audit_events(p_company uuid, p_limit integer DEFAULT 50)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard
  IF public.hmrc_manage_allowed(p_company, auth.uid()) <> 'ok' THEN
    RAISE EXCEPTION 'HMRC_NOT_ALLOWED' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((
    SELECT json_agg(json_build_object('event', x.event, 'reason', x.reason, 'environment', x.environment, 'created_at', x.created_at,
                                      'by_name', x.by_name) ORDER BY x.created_at DESC, x.id DESC)
      FROM (SELECT a.id, a.event, a.reason, a.environment, a.created_at,
                   COALESCE(NULLIF(btrim(p.display_name), ''), NULLIF(btrim(p.full_name), '')) AS by_name
              FROM public.hmrc_audit_log a LEFT JOIN public.profiles p ON p.id = a.user_id
             WHERE a.company_id = p_company
             ORDER BY a.created_at DESC, a.id DESC
             LIMIT least(greatest(COALESCE(p_limit, 50), 1), 200)) x), '[]'::json);
END;
$function$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.hmrc_can_manage(uuid)', 'public.hmrc_connection_status(uuid)', 'public.hmrc_audit_events(uuid,integer)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, service_role', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
END $$;

-- 5. Phase 25 guard log rows.
DO $$
DECLARE
  snip constant text := E'\n  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard';
  f text; src text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.hmrc_can_manage(uuid)', 'public.hmrc_connection_status(uuid)', 'public.hmrc_audit_events(uuid,integer)'] LOOP
    SELECT prosrc INTO src FROM pg_proc WHERE oid = to_regprocedure(f);
    IF position(snip in src) = 0 THEN RAISE EXCEPTION '% has no guard line', f; END IF;
    INSERT INTO public.phase25_mfa_guard_log (fn, kind, old_md5, new_md5) VALUES (f, 'user', md5(replace(src, snip, '')), md5(src));
  END LOOP;
END $$;

-- 6. Final checks.
DO $$
BEGIN
  IF has_table_privilege('authenticated', 'public.hmrc_connections', 'SELECT') OR has_table_privilege('anon', 'public.hmrc_connections', 'SELECT')
     OR has_any_column_privilege('authenticated', 'public.hmrc_connections', 'SELECT')
     OR has_any_column_privilege('authenticated', 'public.hmrc_integrations', 'SELECT,INSERT,UPDATE')
     OR has_column_privilege('authenticated', 'public.hmrc_settings', 'client_secret', 'SELECT')
     OR has_column_privilege('authenticated', 'public.hmrc_settings', 'client_id', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.hmrc_oauth_states', 'SELECT') OR has_table_privilege('authenticated', 'public.hmrc_audit_log', 'SELECT')
     OR has_table_privilege('service_role', 'public.hmrc_audit_log', 'UPDATE') OR has_table_privilege('service_role', 'public.hmrc_audit_log', 'DELETE')
     OR has_function_privilege('anon', 'public.hmrc_connection_status(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.hmrc_manage_allowed(uuid,uuid)', 'EXECUTE')
     OR to_regprocedure('public.get_hmrc_tokens(uuid)') IS NOT NULL OR to_regprocedure('public.decrypt_hmrc_token(text)') IS NOT NULL THEN
    RAISE EXCEPTION 'privileges are not as intended';
  END IF;
END $$;

COMMIT;
