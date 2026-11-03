-- =====================================================================================================================
-- Phase 39: save free-tool work to the account, and record marketing consent (PREPARED, NOT APPLIED).
--
-- ORDER: 1. the owner applies this; 2. publish the frontend. Until step 1 the free tools keep working in the browser
-- only (Phase 38) and the save prompt says "Saving to your account needs a database update"; sign-up works as today.
--
-- What it adds (one transaction; any check failing changes nothing):
--   * public.free_tool_items: one row per thing a person saves from a free tool (an ROI scenario, their goals, a survey,
--     their checklist ticks, a cost or compliance result). Own rows only, no company sharing. Any signed-in account may
--     read its rows; writing needs an account that isn't suspended (free_tools_write_ok). 50 items per user per tool;
--     data at most 64 KB; name 1 to 120 characters; tool one of the seven free tools.
--   * public.marketing_consents: one row per user: consented yes/no, where they signed up from (a free tool or
--     'signup'), which consent wording they saw, and when (server clock). Read: own row. Written ONLY through
--     marketing_consent_set / marketing_consent_record_signup, so the time and wording version always come from the
--     server and a browser can't backdate or edit them. Withdrawing is always possible, even for a suspended account.
--   * Every new SECURITY DEFINER function has the Phase 25 guard line and a guard log row; authenticated only.
--
-- Production facts this was written against (read-only, 3 Nov 2026): md5(prosrc) _access_state_for(uuid)
-- 292e158f87569a1b7bdbe32e64da0a67, mfa_ok() 20516f2ec203220b3ac08d1230c7c306, require_aal2_if_enrolled()
-- 10b2ae7bd2f9a94ea20598f19b8aebf2; auth.users.id uuid primary key. No marketing-consent table or field existed
-- (user_notification_preferences holds task-email switches; email_optouts is an opt-out list for trial emails).
-- Anything else: refused. Rollback: docs/phase39/rollback.sql. Tests: docs/phase39/run-test.sh.
-- =====================================================================================================================
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.free_tool_items') IS NOT NULL OR to_regclass('public.marketing_consents') IS NOT NULL THEN
    RAISE EXCEPTION 'Phase 39 already exists (applied twice?)';
  END IF;
  IF to_regclass('public.phase25_mfa_guard_log') IS NULL OR to_regclass('auth.users') IS NULL THEN
    RAISE EXCEPTION 'Phase 25 / auth.users missing';
  END IF;
  IF (SELECT format_type(a.atttypid, a.atttypmod) FROM pg_attribute a WHERE a.attrelid = 'auth.users'::regclass AND a.attname = 'id') IS DISTINCT FROM 'uuid'
     OR NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conrelid = 'auth.users'::regclass AND c.contype = 'p'
                     AND c.conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'auth.users'::regclass AND attname = 'id')]) THEN
    RAISE EXCEPTION 'auth.users.id is not the uuid primary key this was written against';
  END IF;
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public._access_state_for(uuid)')) IS DISTINCT FROM '292e158f87569a1b7bdbe32e64da0a67'
     OR (SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.mfa_ok()')) IS DISTINCT FROM '20516f2ec203220b3ac08d1230c7c306'
     OR (SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.require_aal2_if_enrolled()')) IS DISTINCT FROM '10b2ae7bd2f9a94ea20598f19b8aebf2' THEN
    RAISE EXCEPTION 'a helper differs from the body this was written against';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public'
              AND p.proname IN ('free_tools_write_ok', '_free_tool_item_guard', 'marketing_consent_set', 'marketing_consent_record_signup')) THEN
    RAISE EXCEPTION 'a Phase 39 function name is already taken';
  END IF;
END $$;

-- 1. Saved free-tool items.
CREATE TABLE public.free_tool_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool text NOT NULL CONSTRAINT fti_tool CHECK (tool IN ('roi-calculator', 'goal-tracker', 'customer-survey-builder', 'cost-calculator',
                                                          'setup-checklist', 'compliance', 'best-practices')),
  name text NOT NULL CONSTRAINT fti_name CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  data jsonb NOT NULL DEFAULT '{}'::jsonb CONSTRAINT fti_data CHECK (jsonb_typeof(data) IN ('object', 'array') AND pg_column_size(data) <= 65536),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.free_tool_items IS 'Phase 39: what a person saves from a free Business Tool. Own rows only.';
CREATE INDEX free_tool_items_user_tool_idx ON public.free_tool_items (user_id, tool, updated_at DESC);

-- 50 per user per tool; the owner and tool never change; updated_at from the server.
CREATE FUNCTION public._free_tool_item_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.tool IS DISTINCT FROM OLD.tool) THEN
    RAISE EXCEPTION 'FREE_TOOL_ITEM_FIXED' USING ERRCODE = '22023', HINT = 'An item stays with its owner and tool.';
  END IF;
  IF TG_OP = 'INSERT' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('free_tool_items:' || NEW.user_id::text || ':' || NEW.tool, 0));
    IF (SELECT count(*) FROM public.free_tool_items i WHERE i.user_id = NEW.user_id AND i.tool = NEW.tool) >= 50 THEN
      RAISE EXCEPTION 'FREE_TOOL_ITEM_LIMIT' USING ERRCODE = '22023', HINT = 'You can save up to 50 items in each tool. Delete one first.';
    END IF;
    NEW.created_at := now();
  END IF;
  NEW.name := btrim(NEW.name);
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public._free_tool_item_guard() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER free_tool_item_guard BEFORE INSERT OR UPDATE ON public.free_tool_items
  FOR EACH ROW EXECUTE FUNCTION public._free_tool_item_guard();

-- Who may write: any signed-in account except a suspended one (trial ended and no plan included: the free tier).
CREATE FUNCTION public.free_tools_write_ok()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard
  RETURN auth.uid() IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public._access_state_for(auth.uid()) s WHERE s.state = 'suspended');
END;
$function$;

ALTER TABLE public.free_tool_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY fti_own_select ON public.free_tool_items FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY fti_own_insert ON public.free_tool_items FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY fti_own_update ON public.free_tool_items FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY fti_own_delete ON public.free_tool_items FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY require_aal2_if_enrolled ON public.free_tool_items AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
-- Suspended accounts read only.
CREATE POLICY fti_write_insert ON public.free_tool_items AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK ((SELECT public.free_tools_write_ok()));
CREATE POLICY fti_write_update ON public.free_tool_items AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((SELECT public.free_tools_write_ok())) WITH CHECK ((SELECT public.free_tools_write_ok()));
CREATE POLICY fti_write_delete ON public.free_tool_items AS RESTRICTIVE FOR DELETE TO authenticated USING ((SELECT public.free_tools_write_ok()));
REVOKE ALL ON public.free_tool_items FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.free_tool_items TO authenticated;
GRANT ALL ON public.free_tool_items TO service_role;

-- 2. Marketing consent.
CREATE TABLE public.marketing_consents (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  consented boolean NOT NULL,
  source text NOT NULL CONSTRAINT mc_source CHECK (source IN ('signup', 'settings', 'roi-calculator', 'goal-tracker', 'customer-survey-builder',
                                                              'cost-calculator', 'setup-checklist', 'compliance', 'best-practices')),
  consent_text_version text NOT NULL CONSTRAINT mc_version CHECK (char_length(consent_text_version) BETWEEN 1 AND 40),
  consented_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mc_consented_at CHECK ((consented AND consented_at IS NOT NULL) OR NOT consented)
);
COMMENT ON TABLE public.marketing_consents IS
  'Phase 39: marketing email consent (UK GDPR / PECR). Only consented = true may be emailed for marketing. Wording v1: "Send me tips and offers about B2BNEST. You can unsubscribe at any time."';
ALTER TABLE public.marketing_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY mc_own_select ON public.marketing_consents FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY require_aal2_if_enrolled ON public.marketing_consents AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
REVOKE ALL ON public.marketing_consents FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.marketing_consents TO authenticated;
GRANT ALL ON public.marketing_consents TO service_role;

-- Change your own choice (Settings, or "Send me tips" later). Server clock; version 'v1'. consented_at = when the latest
-- yes was given; kept as null after a withdrawal of a choice that was never yes.
CREATE FUNCTION public.marketing_consent_set(p_consented boolean, p_source text DEFAULT 'settings')
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE uid uuid := auth.uid(); v_row public.marketing_consents;
BEGIN
  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard
  IF uid IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_consented IS NULL THEN RAISE EXCEPTION 'CONSENT_REQUIRED' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.marketing_consents (user_id, consented, source, consent_text_version, consented_at, updated_at)
  VALUES (uid, p_consented, COALESCE(p_source, 'settings'), 'v1', CASE WHEN p_consented THEN now() END, now())
  ON CONFLICT (user_id) DO UPDATE
     SET consented = EXCLUDED.consented, consent_text_version = 'v1',
         consented_at = CASE WHEN EXCLUDED.consented THEN now() ELSE public.marketing_consents.consented_at END,
         updated_at = now()
  RETURNING * INTO v_row;
  RETURN row_to_json(v_row);
END;
$function$;

-- After the first sign-in: record the choice made on the sign-up form (kept in the account's sign-up details by Supabase
-- Auth: marketing_consent, signup_source). Only when no choice is recorded yet; later choices always win.
CREATE FUNCTION public.marketing_consent_record_signup()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  uid uuid := auth.uid();
  v_meta jsonb;
  v_yes boolean;
  v_source text;
  v_row public.marketing_consents;
BEGIN
  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard
  IF uid IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_row FROM public.marketing_consents WHERE user_id = uid;
  IF FOUND THEN RETURN json_build_object('recorded', false, 'reason', 'already_recorded'); END IF;
  SELECT u.raw_user_meta_data INTO v_meta FROM auth.users u WHERE u.id = uid;
  IF v_meta IS NULL OR NOT (v_meta ? 'marketing_consent') THEN RETURN json_build_object('recorded', false, 'reason', 'no_choice'); END IF;
  v_yes := lower(v_meta ->> 'marketing_consent') = 'true';
  v_source := v_meta ->> 'signup_source';
  IF v_source IS NULL OR v_source NOT IN ('roi-calculator', 'goal-tracker', 'customer-survey-builder', 'cost-calculator', 'setup-checklist',
                                          'compliance', 'best-practices') THEN
    v_source := 'signup';
  END IF;
  INSERT INTO public.marketing_consents (user_id, consented, source, consent_text_version, consented_at, updated_at)
  VALUES (uid, v_yes, v_source, 'v1', CASE WHEN v_yes THEN now() END, now())
  RETURNING * INTO v_row;
  RETURN json_build_object('recorded', true, 'consented', v_row.consented, 'source', v_row.source);
END;
$function$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.free_tools_write_ok()', 'public.marketing_consent_set(boolean,text)', 'public.marketing_consent_record_signup()'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, service_role', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
END $$;

-- 3. Phase 25 guard log rows.
DO $$
DECLARE
  snip constant text := E'\n  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard';
  f text; src text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.free_tools_write_ok()', 'public.marketing_consent_set(boolean,text)', 'public.marketing_consent_record_signup()'] LOOP
    SELECT prosrc INTO src FROM pg_proc WHERE oid = to_regprocedure(f);
    IF position(snip in src) = 0 THEN RAISE EXCEPTION '% has no guard line', f; END IF;
    INSERT INTO public.phase25_mfa_guard_log (fn, kind, old_md5, new_md5) VALUES (f, 'user', md5(replace(src, snip, '')), md5(src));
  END LOOP;
END $$;

-- 4. Final checks.
DO $$
BEGIN
  IF has_table_privilege('anon', 'public.free_tool_items', 'SELECT') OR has_table_privilege('anon', 'public.marketing_consents', 'SELECT')
     OR has_table_privilege('authenticated', 'public.marketing_consents', 'INSERT') OR has_table_privilege('authenticated', 'public.marketing_consents', 'UPDATE')
     OR has_function_privilege('anon', 'public.marketing_consent_set(boolean,text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.marketing_consent_record_signup()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.free_tools_write_ok()', 'EXECUTE') THEN
    RAISE EXCEPTION 'privileges are not as intended';
  END IF;
END $$;

COMMIT;
