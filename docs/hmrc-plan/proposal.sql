-- =====================================================================================================================
-- HMRC tools on the Business and Scale plans only (and during the 14-day trial). PREPARED, NOT APPLIED.
--
-- ORDER (docs/hmrc-plan/README.md): 1 the owner applies this; 2 redeploy hmrc-connect-start / hmrc-connect-complete /
-- hmrc-disconnect if they are deployed; 3 publish the frontend.
--
-- What it changes (one transaction; any check failing changes nothing):
--   1. public.hmrc_manage_allowed(uuid, uuid) (service role only; used by the Edge Functions and by hmrc_can_manage,
--      hmrc_connection_status and hmrc_audit_events) gains one reason, plan_not_included: a paying account
--      (state 'subscribed') whose plan is not Business ('professional') or Scale ('enterprise'). Order of reasons:
--      not_signed_in, not_member, suspended, trial_ended, plan_not_included, not_admin, ok. Everything else is byte for
--      byte as before; grants unchanged (service role only).
--   2. public.hmrc_connection_status(uuid) returns {access:'plan_not_included', can_manage:false, connections:[]} for
--      that reason, like trial_ended / suspended; nothing else changes (same Phase 25 guard line, same grants). Its
--      guard log row is updated to the new hash.
--   hmrc_can_manage and hmrc_audit_events are not changed: they already allow only 'ok'.
--
-- Production facts this was written against (read-only, 4 Nov 2026): md5(prosrc) hmrc_manage_allowed
-- 9da6644ed17385ccb8c0d184e206ccab, hmrc_can_manage 1d40a67edbcea7a53e09f9acb986630f, hmrc_connection_status
-- 588c2a91667fb727284ad0c72608274d, hmrc_audit_events 47b3d4d71f94b27c947a4f6e007bc182, _access_state_for
-- 292e158f87569a1b7bdbe32e64da0a67, user_is_organization_member 1fb55538d44b2451875f8baf1b6e4388,
-- user_is_organization_admin c6dd628541413ec82565a6676a55a767; plan keys in plan_prices: starter, professional,
-- enterprise. Anything else: refused. Rollback: docs/hmrc-plan/rollback.sql. Tests: docs/hmrc-plan/run-test.sh.
-- =====================================================================================================================
BEGIN;

DO $$
DECLARE r record;
BEGIN
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.hmrc_manage_allowed(uuid,uuid)')) IS DISTINCT FROM '9da6644ed17385ccb8c0d184e206ccab' THEN
    IF position('plan_not_included' in (SELECT prosrc FROM pg_proc WHERE oid = to_regprocedure('public.hmrc_manage_allowed(uuid,uuid)'))) > 0 THEN
      RAISE EXCEPTION 'HMRC plan rule already exists (applied twice?)';
    END IF;
    RAISE EXCEPTION 'hmrc_manage_allowed differs from the HMRC P0 body this was written against';
  END IF;
  FOR r IN SELECT * FROM (VALUES
      ('public.hmrc_can_manage(uuid)', '1d40a67edbcea7a53e09f9acb986630f', 'authenticated=X/postgres,postgres=X/postgres'),
      ('public.hmrc_connection_status(uuid)', '588c2a91667fb727284ad0c72608274d', 'authenticated=X/postgres,postgres=X/postgres'),
      ('public.hmrc_audit_events(uuid,integer)', '47b3d4d71f94b27c947a4f6e007bc182', 'authenticated=X/postgres,postgres=X/postgres'),
      ('public.hmrc_manage_allowed(uuid,uuid)', '9da6644ed17385ccb8c0d184e206ccab', 'postgres=X/postgres,service_role=X/postgres'),
      ('public._access_state_for(uuid)', '292e158f87569a1b7bdbe32e64da0a67', 'postgres=X/postgres,service_role=X/postgres'),
      ('public.user_is_organization_member(uuid,uuid)', '1fb55538d44b2451875f8baf1b6e4388', NULL),
      ('public.user_is_organization_admin(uuid,uuid)', 'c6dd628541413ec82565a6676a55a767', NULL)) v(fn, h, acl) LOOP
    IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure(r.fn)) IS DISTINCT FROM r.h THEN
      RAISE EXCEPTION '% differs from the production body this was written against', r.fn;
    END IF;
    IF r.acl IS NOT NULL AND (SELECT string_agg(x, ',' ORDER BY x) FROM unnest((SELECT proacl::text[] FROM pg_proc WHERE oid = to_regprocedure(r.fn))) x) IS DISTINCT FROM r.acl THEN
      RAISE EXCEPTION '% privileges differ from production', r.fn;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM public.phase25_mfa_guard_log WHERE fn = 'public.hmrc_connection_status(uuid)' AND kind = 'user'
                  AND old_md5 = '6046f16dab5ce5e796223bab7ae3cca8' AND new_md5 = '588c2a91667fb727284ad0c72608274d') THEN
    RAISE EXCEPTION 'the guard log row for hmrc_connection_status differs from production';
  END IF;
END $$;

-- 1. The plan rule (CREATE OR REPLACE keeps the grants; checked below).
CREATE OR REPLACE FUNCTION public.hmrc_manage_allowed(p_company uuid, p_user uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
DECLARE v_state text; v_plan text;
BEGIN
  IF p_user IS NULL THEN RETURN 'not_signed_in'; END IF;
  IF p_company IS NULL OR NOT public.user_is_organization_member(p_company, p_user) THEN RETURN 'not_member'; END IF;
  SELECT s.state, s.plan_key INTO v_state, v_plan FROM public._access_state_for(p_user) s;
  IF v_state = 'suspended' THEN RETURN 'suspended'; END IF;
  IF v_state = 'trial_ended' OR v_state IS NULL THEN RETURN 'trial_ended'; END IF;
  -- HMRC tools are a Business ('professional') and Scale ('enterprise') feature, like Workflow Studio. The trial and
  -- owner / master accounts (state 'owner') keep them. A member of a company follows the plan of the account that pays
  -- (_access_state_for reports it with via = 'company'). Any other plan key, or none, is not included (fails closed).
  IF v_state = 'subscribed' AND lower(btrim(coalesce(v_plan, ''))) NOT IN ('professional', 'enterprise') THEN RETURN 'plan_not_included'; END IF;
  IF NOT public.user_is_organization_admin(p_company, p_user) THEN RETURN 'not_admin'; END IF;
  RETURN 'ok';
END;
$function$;

-- 2. The status for that reason.
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
  IF v_rule IN ('trial_ended', 'suspended', 'plan_not_included') THEN
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
DECLARE
  snip constant text := E'\n  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard';
  src text := (SELECT prosrc FROM pg_proc WHERE oid = 'public.hmrc_connection_status(uuid)'::regprocedure);
BEGIN
  IF position(snip in src) = 0 THEN RAISE EXCEPTION 'no guard line'; END IF;
  UPDATE public.phase25_mfa_guard_log SET old_md5 = md5(replace(src, snip, '')), new_md5 = md5(src)  -- applied_at kept, so the rollback restores the row exactly
   WHERE fn = 'public.hmrc_connection_status(uuid)';
  IF (SELECT string_agg(x, ',' ORDER BY x) FROM unnest((SELECT proacl::text[] FROM pg_proc WHERE oid = 'public.hmrc_manage_allowed(uuid,uuid)'::regprocedure)) x)
       IS DISTINCT FROM 'postgres=X/postgres,service_role=X/postgres'
     OR (SELECT string_agg(x, ',' ORDER BY x) FROM unnest((SELECT proacl::text[] FROM pg_proc WHERE oid = 'public.hmrc_connection_status(uuid)'::regprocedure)) x)
       IS DISTINCT FROM 'authenticated=X/postgres,postgres=X/postgres' THEN
    RAISE EXCEPTION 'privileges are not as intended';
  END IF;
END $$;

COMMIT;
