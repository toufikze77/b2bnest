-- =====================================================================================================================
-- HMRC P7d: stop signed-out visitors (the anon role) running five database helpers they never need. PREPARED, NOT
-- APPLIED. Revoke only: no function body, policy, trigger, table or other grant changes. One transaction; any check
-- failing changes nothing.
--
-- Revoked from anon (and PUBLIC); authenticated and service_role keep EXECUTE:
--   is_project_member(uuid,uuid), is_team_member(uuid,uuid), owns_team(uuid,uuid), user_can_access_project(uuid,uuid):
--     each takes a user id and returns true or false. They are used only by policies for the authenticated role and by
--     SECURITY DEFINER functions (which run as their owner), so nothing a signed-out visitor does needs them.
--   get_invitation_by_token(text): returns an invitation's email, role, company and expiry to whoever holds the token.
--     The app no longer calls it: the invite page uses org_invitation_preview, which needs a signed-in session.
--
-- Deliberately KEPT for anon (docs/hmrc-p7d/README.md): has_role, is_admin_or_owner, is_super_admin,
-- user_is_organization_admin, user_is_organization_member, user_is_organization_owner and user_owns_project are
-- evaluated by policies written for the "public" role, which includes anon. Revoking them could break an anonymous
-- read (for example staking_reward_pools, organization_members). email_unsubscribe, template_usage_counts,
-- _data_rights_gate_is_open, is_safe_profile_field and the two wave1_* trigger functions are fine as they are.
--
-- Production facts this was written against (read-only, 9 Nov 2026): 148 tables in public (md5 of the sorted names
-- ca2f5c858ee858f9b3f7c14131e00b9f); md5(prosrc) of the five as below; anon, authenticated and service_role each
-- hold EXECUTE on all five; no policy for anon or public, view, column default or CHECK calls any of them; no
-- SECURITY INVOKER function that anon can run calls any of them. Anything else: refused.
-- Rollback: docs/hmrc-p7d/rollback.sql. Tests: docs/hmrc-p7d/run-test.sh.
-- =====================================================================================================================
BEGIN;

DO $$
DECLARE r record; v text;
BEGIN
  IF NOT has_function_privilege('anon', 'public.is_project_member(uuid,uuid)', 'EXECUTE')
     AND NOT has_function_privilege('anon', 'public.get_invitation_by_token(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'HMRC P7d already applied (anon cannot run the helpers)';
  END IF;
  IF (SELECT md5(string_agg(relname, ',' ORDER BY relname)) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind IN ('r', 'p'))
     IS DISTINCT FROM 'ca2f5c858ee858f9b3f7c14131e00b9f' THEN
    RAISE EXCEPTION 'the tables in public differ from production as read on 9 Nov 2026';
  END IF;
  FOR r IN SELECT * FROM (VALUES
      ('public.is_project_member(uuid,uuid)', 'is_project_member', 'a2e30ee2428aeba1406b277aa5a6e653'),
      ('public.is_team_member(uuid,uuid)', 'is_team_member', '589fb0e6fc56c14233e66a8564809ac3'),
      ('public.owns_team(uuid,uuid)', 'owns_team', '178218309894c3bfab5c338a590d7fcd'),
      ('public.user_can_access_project(uuid,uuid)', 'user_can_access_project', '29b1466b2b98c3917924cc62ca3de023'),
      ('public.get_invitation_by_token(text)', 'get_invitation_by_token', 'dc1a3743a222906f765a033a91600a35')) x(fn, name, h) LOOP
    IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure(r.fn)) IS DISTINCT FROM r.h THEN
      RAISE EXCEPTION '% differs from the production body this was written against (or is missing)', r.fn;
    END IF;
    IF NOT (has_function_privilege('anon', r.fn, 'EXECUTE') AND has_function_privilege('authenticated', r.fn, 'EXECUTE')
            AND has_function_privilege('service_role', r.fn, 'EXECUTE')) THEN
      RAISE EXCEPTION '% grants differ from production', r.fn;
    END IF;
    -- A policy that evaluates a helper needs the caller to have EXECUTE on it: none for anon or public may use these.
    SELECT string_agg(tablename || '.' || policyname, ', ') INTO v FROM pg_policies
     WHERE roles && ARRAY['anon', 'public']::name[] AND (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ ('\m' || r.name || '\(');
    IF v IS NOT NULL THEN RAISE EXCEPTION '% is used by an anon or public policy (%): not revoked', r.fn, v; END IF;
    SELECT string_agg(c.oid::regclass::text, ', ') INTO v FROM pg_class c
     WHERE c.relkind IN ('v', 'm') AND c.relnamespace NOT IN ('pg_catalog'::regnamespace, 'information_schema'::regnamespace)
       AND pg_get_viewdef(c.oid) ~ ('\m' || r.name || '\(');
    IF v IS NOT NULL THEN RAISE EXCEPTION '% is used by a view (%): not revoked', r.fn, v; END IF;
    IF EXISTS (SELECT 1 FROM pg_attrdef d WHERE pg_get_expr(d.adbin, d.adrelid) ~ ('\m' || r.name || '\('))
       OR EXISTS (SELECT 1 FROM pg_constraint c WHERE c.contype = 'c' AND pg_get_constraintdef(c.oid) ~ ('\m' || r.name || '\(')) THEN
      RAISE EXCEPTION '% is used by a column default or CHECK: not revoked', r.fn;
    END IF;
    SELECT string_agg(p.oid::regprocedure::text, ', ') INTO v FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace AND NOT p.prosecdef AND p.proname <> r.name
       AND has_function_privilege('anon', p.oid, 'EXECUTE') AND p.prosrc ~ ('\m' || r.name || '\(');
    IF v IS NOT NULL THEN RAISE EXCEPTION '% is called by a SECURITY INVOKER function anon can run (%): not revoked', r.fn, v; END IF;
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION public.is_project_member(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.owns_team(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_can_access_project(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_invitation_by_token(text) FROM anon, PUBLIC;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.is_project_member(uuid,uuid)', 'public.is_team_member(uuid,uuid)', 'public.owns_team(uuid,uuid)',
                           'public.user_can_access_project(uuid,uuid)', 'public.get_invitation_by_token(text)'] LOOP
    IF has_function_privilege('anon', f, 'EXECUTE') OR NOT has_function_privilege('authenticated', f, 'EXECUTE')
       OR NOT has_function_privilege('service_role', f, 'EXECUTE') THEN
      RAISE EXCEPTION 'privileges on % are not as intended', f;
    END IF;
  END LOOP;
END $$;

COMMIT;
