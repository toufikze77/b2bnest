-- =====================================================================================================================
-- HMRC hide switch: one platform setting that hides HMRC's TEST-environment features from customers until HMRC
-- approves production. PREPARED, NOT APPLIED. Additive only; one transaction; any check failing changes nothing.
--
-- It reuses public.platform_settings (key text PRIMARY KEY, value jsonb, updated_by, updated_at; super admins read and
-- write it under RLS, aal2 when enrolled, demo guard trigger). It adds:
--   1. The row  key = 'hmrc_customer_access', value = "hidden"  (seeded HIDDEN: safe by default).
--   2. A SELECT policy so every signed-in person can read THAT key only (nothing else in the table, and not anon).
--   3. public.hmrc_set_customer_access(p_state): super admins only (aal2 required by require_aal2_admin), 'visible' or
--      'hidden'; records who and when on the row and writes an admin audit entry (admin_log_action) in the same
--      transaction. The browser's Admin page calls it.
--   4. public.hmrc_customer_access_status(): super admins only; the state, when it changed and the email of who changed it.
-- Not changed: any other policy, grant, trigger, function body, table or row; HMRC data; plans, prices, Stripe.
--
-- Who still sees HMRC when hidden is decided by the Edge Functions and the app from public.user_roles: 'super_admin' or
-- 'admin'. Only super admins can give those roles (RLS on user_roles, admin_set_user_role); 'super_admin' can't be given
-- through the API at all (prevent_super_admin_escalation). No customer flow creates them.
--
-- Production facts this was written against (read-only, 9 Nov 2026): 148 tables in public (md5 of the sorted names
-- ca2f5c858ee858f9b3f7c14131e00b9f); platform_settings columns key/value/updated_by/updated_at with primary key (key),
-- RLS on, exactly the four policies below, keys platform, maintenance_mode, community_enabled (no hmrc_customer_access);
-- md5(prosrc) is_super_admin 246e360cf6b2ed74a7ff7c96cbbf2351, require_aal2_admin 25c85041df1954badee597040374a6fd,
-- admin_log_action 92a000fe89ec220db8f85aff178f378c. Anything else: refused.
-- Rollback: docs/hmrc-hide/rollback.sql. Tests: docs/hmrc-hide/run-test.sh.
-- =====================================================================================================================
BEGIN;

DO $$
DECLARE r record; v text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.platform_settings WHERE key = 'hmrc_customer_access')
     OR to_regprocedure('public.hmrc_set_customer_access(text)') IS NOT NULL THEN
    RAISE EXCEPTION 'HMRC hide switch already exists (applied twice?)';
  END IF;
  IF (SELECT md5(string_agg(relname, ',' ORDER BY relname)) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind IN ('r', 'p'))
     IS DISTINCT FROM 'ca2f5c858ee858f9b3f7c14131e00b9f' THEN
    RAISE EXCEPTION 'the tables in public differ from production as read on 9 Nov 2026';
  END IF;
  SELECT string_agg(column_name || ':' || data_type, ',' ORDER BY column_name) INTO v FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'platform_settings';
  IF v IS DISTINCT FROM 'key:text,updated_at:timestamp with time zone,updated_by:uuid,value:jsonb' THEN
    RAISE EXCEPTION 'platform_settings columns differ from production (%)', v;
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.platform_settings'::regclass) THEN RAISE EXCEPTION 'platform_settings RLS is off'; END IF;
  SELECT string_agg(policyname || ':' || cmd || ':' || permissive, ',' ORDER BY policyname) INTO v FROM pg_policies WHERE schemaname = 'public' AND tablename = 'platform_settings';
  IF v IS DISTINCT FROM 'require_aal2_if_enrolled:ALL:RESTRICTIVE,super admins insert settings:INSERT:PERMISSIVE,super admins read settings:SELECT:PERMISSIVE,super admins update settings:UPDATE:PERMISSIVE' THEN
    RAISE EXCEPTION 'platform_settings policies differ from production (%)', v;
  END IF;
  FOR r IN SELECT * FROM (VALUES
      ('public.is_super_admin(uuid)', '246e360cf6b2ed74a7ff7c96cbbf2351'),
      ('public.require_aal2_admin()', '25c85041df1954badee597040374a6fd'),
      ('public.admin_log_action(text,text,text,jsonb,text)', '92a000fe89ec220db8f85aff178f378c')) x(fn, h) LOOP
    IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure(r.fn)) IS DISTINCT FROM r.h THEN
      RAISE EXCEPTION '% differs from production (or is missing)', r.fn;
    END IF;
  END LOOP;
END $$;

-- 1. The switch, seeded hidden.
INSERT INTO public.platform_settings (key, value, updated_by, updated_at) VALUES ('hmrc_customer_access', '"hidden"'::jsonb, NULL, now());

-- 2. Every signed-in person may read this one key (the app decides what to show from it). Anon still reads nothing.
CREATE POLICY "signed-in people read the HMRC access setting" ON public.platform_settings FOR SELECT TO authenticated
  USING (key = 'hmrc_customer_access');

-- 3. The only write path the app uses: super admins, aal2, audited.
CREATE FUNCTION public.hmrc_set_customer_access(p_state text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  PERFORM public.require_aal2_admin();
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;
  IF p_state IS NULL OR p_state NOT IN ('visible', 'hidden') THEN RAISE EXCEPTION 'HMRC_ACCESS_STATE: visible or hidden only' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.platform_settings (key, value, updated_by, updated_at) VALUES ('hmrc_customer_access', to_jsonb(p_state), auth.uid(), now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = EXCLUDED.updated_at;
  PERFORM public.admin_log_action('settings.hmrc_customer_access', 'platform_settings', 'hmrc_customer_access', jsonb_build_object('state', p_state), 'success');
  RETURN p_state;
END;
$function$;
REVOKE ALL ON FUNCTION public.hmrc_set_customer_access(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hmrc_set_customer_access(text) TO authenticated, service_role;

-- 4. What the Admin page shows: the state, when, and who (super admins only).
CREATE FUNCTION public.hmrc_customer_access_status()
 RETURNS TABLE(state text, updated_at timestamp with time zone, updated_by_email text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  PERFORM public.require_aal2_admin();
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
    SELECT CASE WHEN s.value = '"visible"'::jsonb THEN 'visible' ELSE 'hidden' END, s.updated_at, u.email::text
      FROM (SELECT 1) one
      LEFT JOIN public.platform_settings s ON s.key = 'hmrc_customer_access'
      LEFT JOIN auth.users u ON u.id = s.updated_by;
END;
$function$;
REVOKE ALL ON FUNCTION public.hmrc_customer_access_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hmrc_customer_access_status() TO authenticated, service_role;

DO $$
BEGIN
  IF has_function_privilege('anon', 'public.hmrc_set_customer_access(text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.hmrc_customer_access_status()', 'EXECUTE')
     OR (SELECT value FROM public.platform_settings WHERE key = 'hmrc_customer_access') IS DISTINCT FROM '"hidden"'::jsonb THEN
    RAISE EXCEPTION 'not as intended';
  END IF;
END $$;

COMMIT;
