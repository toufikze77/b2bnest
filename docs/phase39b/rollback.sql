-- =====================================================================================================================
-- Phase 39b rollback (one transaction): puts back the exact Phase 39 body of marketing_consent_record_signup()
-- (md5 92b26481e8c7b688d055bde1c0360953) and its guard log row. Rows already recorded in marketing_consents stay
-- (they are all consented = false unless someone chose yes). Refuses unless the Phase 39b body is the one in place.
-- =====================================================================================================================
BEGIN;
DO $$
BEGIN
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.marketing_consent_record_signup()')) IS DISTINCT FROM
     (SELECT new_md5 FROM public.phase25_mfa_guard_log WHERE fn = 'public.marketing_consent_record_signup()')
     OR (SELECT new_md5 FROM public.phase25_mfa_guard_log WHERE fn = 'public.marketing_consent_record_signup()') = '92b26481e8c7b688d055bde1c0360953' THEN
    RAISE EXCEPTION 'Phase 39b is not applied (or the function has changed since)';
  END IF;
END $$;

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
BEGIN
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.marketing_consent_record_signup()'::regprocedure) <> '92b26481e8c7b688d055bde1c0360953' THEN
    RAISE EXCEPTION 'did not return to the Phase 39 body';
  END IF;
  UPDATE public.phase25_mfa_guard_log SET old_md5 = '663d400f45ba5bb535618ec278d92fe0', new_md5 = '92b26481e8c7b688d055bde1c0360953'
   WHERE fn = 'public.marketing_consent_record_signup()';
END $$;
COMMIT;
