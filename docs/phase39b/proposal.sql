-- =====================================================================================================================
-- Phase 39b: record which free tool a sign-up came from, now that the sign-up form has no marketing checkbox
-- (PREPARED, NOT APPLIED).
--
-- Replaces public.marketing_consent_record_signup() only. Nothing else changes; no table, no data, no grant.
--   * Sign-up details with signup_source and no marketing_consent (every sign-up after this frontend):
--     records consented = false with that source (a free tool id, else 'signup'). Never true without a choice.
--   * Sign-up details with marketing_consent (accounts made while the Phase 39 checkbox existed): as before.
--   * Nothing in the sign-up details, or a row already there (a later choice always wins): nothing recorded.
-- Same Phase 25 guard line, SECURITY DEFINER, search_path '', EXECUTE for authenticated only; its guard log row is
-- updated to the new body hash.
--
-- Production facts this was written against (read-only, 3 Nov 2026): md5(prosrc) of marketing_consent_record_signup()
-- 92b26481e8c7b688d055bde1c0360953 (the Phase 39 body), ACL {postgres=X, authenticated=X}, guard log row
-- (user, 663d400f45ba5bb535618ec278d92fe0, 92b26481e8c7b688d055bde1c0360953). Anything else: refused.
-- Until this is applied, the Phase 39 function records nothing for new sign-ups (no error is shown to anyone).
-- Rollback: docs/phase39b/rollback.sql. Tests: docs/phase39b/run-test.sh.
-- =====================================================================================================================
BEGIN;

DO $$
DECLARE h text := (SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.marketing_consent_record_signup()'));
BEGIN
  IF h IS NULL THEN RAISE EXCEPTION 'Phase 39 is not applied (marketing_consent_record_signup missing)'; END IF;
  IF h <> '92b26481e8c7b688d055bde1c0360953' THEN
    IF EXISTS (SELECT 1 FROM public.phase25_mfa_guard_log WHERE fn = 'public.marketing_consent_record_signup()' AND new_md5 = h AND old_md5 <> '663d400f45ba5bb535618ec278d92fe0') THEN
      RAISE EXCEPTION 'Phase 39b already exists (applied twice?)';
    END IF;
    RAISE EXCEPTION 'marketing_consent_record_signup differs from the Phase 39 body this was written against (md5 %)', h;
  END IF;
  IF (SELECT array_agg(x ORDER BY x) FROM unnest((SELECT proacl::text[] FROM pg_proc WHERE oid = 'public.marketing_consent_record_signup()'::regprocedure)) x)
     IS DISTINCT FROM ARRAY['authenticated=X/postgres', 'postgres=X/postgres'] THEN
    RAISE EXCEPTION 'marketing_consent_record_signup privileges differ from production';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.phase25_mfa_guard_log WHERE fn = 'public.marketing_consent_record_signup()' AND kind = 'user'
                  AND old_md5 = '663d400f45ba5bb535618ec278d92fe0' AND new_md5 = '92b26481e8c7b688d055bde1c0360953') THEN
    RAISE EXCEPTION 'the guard log row for marketing_consent_record_signup differs from production';
  END IF;
  IF to_regclass('public.marketing_consents') IS NULL THEN RAISE EXCEPTION 'public.marketing_consents missing'; END IF;
END $$;

-- CREATE OR REPLACE keeps the privileges (checked below).
CREATE OR REPLACE FUNCTION public.marketing_consent_record_signup()
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
  IF v_meta IS NULL OR NOT (v_meta ? 'marketing_consent' OR v_meta ? 'signup_source') THEN
    RETURN json_build_object('recorded', false, 'reason', 'no_choice');
  END IF;
  -- Yes only from an explicit choice (the Phase 39 checkbox); a sign-up source alone is always no.
  v_yes := v_meta ? 'marketing_consent' AND lower(v_meta ->> 'marketing_consent') = 'true';
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
DECLARE
  snip constant text := E'\n  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard';
  src text := (SELECT prosrc FROM pg_proc WHERE oid = 'public.marketing_consent_record_signup()'::regprocedure);
BEGIN
  IF position(snip in src) = 0 THEN RAISE EXCEPTION 'no guard line'; END IF;
  UPDATE public.phase25_mfa_guard_log SET old_md5 = md5(replace(src, snip, '')), new_md5 = md5(src), applied_at = now()
   WHERE fn = 'public.marketing_consent_record_signup()';
  IF (SELECT array_agg(x ORDER BY x) FROM unnest((SELECT proacl::text[] FROM pg_proc WHERE oid = 'public.marketing_consent_record_signup()'::regprocedure)) x)
     IS DISTINCT FROM ARRAY['authenticated=X/postgres', 'postgres=X/postgres']
     OR has_function_privilege('anon', 'public.marketing_consent_record_signup()', 'EXECUTE') THEN
    RAISE EXCEPTION 'privileges are not as intended';
  END IF;
END $$;

COMMIT;
