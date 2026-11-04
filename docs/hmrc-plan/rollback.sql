-- =====================================================================================================================
-- HMRC plan rule rollback (one transaction): puts back the exact HMRC P0 bodies of hmrc_manage_allowed
-- (md5 9da6644e…) and hmrc_connection_status (md5 588c2a91…) and the latter's guard log row. No data changes.
-- Refuses unless the plan-rule versions are the ones in place.
-- =====================================================================================================================
BEGIN;
DO $$
BEGIN
  IF position('plan_not_included' in COALESCE((SELECT prosrc FROM pg_proc WHERE oid = to_regprocedure('public.hmrc_manage_allowed(uuid,uuid)')), '')) = 0
     OR position('plan_not_included' in COALESCE((SELECT prosrc FROM pg_proc WHERE oid = to_regprocedure('public.hmrc_connection_status(uuid)')), '')) = 0 THEN
    RAISE EXCEPTION 'the HMRC plan rule is not applied';
  END IF;
  IF (SELECT new_md5 FROM public.phase25_mfa_guard_log WHERE fn = 'public.hmrc_connection_status(uuid)')
     IS DISTINCT FROM (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.hmrc_connection_status(uuid)'::regprocedure) THEN
    RAISE EXCEPTION 'hmrc_connection_status has changed since the plan rule was applied';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.hmrc_manage_allowed(p_company uuid, p_user uuid)
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

CREATE OR REPLACE FUNCTION public.hmrc_connection_status(p_company uuid)
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

DO $$
BEGIN
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.hmrc_manage_allowed(uuid,uuid)'::regprocedure) <> '9da6644ed17385ccb8c0d184e206ccab'
     OR (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.hmrc_connection_status(uuid)'::regprocedure) <> '588c2a91667fb727284ad0c72608274d' THEN
    RAISE EXCEPTION 'did not return to the HMRC P0 bodies';
  END IF;
  UPDATE public.phase25_mfa_guard_log SET old_md5 = '6046f16dab5ce5e796223bab7ae3cca8', new_md5 = '588c2a91667fb727284ad0c72608274d'
   WHERE fn = 'public.hmrc_connection_status(uuid)';
END $$;
COMMIT;
