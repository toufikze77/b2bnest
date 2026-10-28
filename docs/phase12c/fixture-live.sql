-- Phase 12c test fixture: live definitions read from production gvftvswyrevummbvyhxa on 2026-10-28 (read-only), body
-- (prosrc) verbatim. Loaded by run-test.sh on top of the Phase 12 and 12b harness. Never run this on production.
CREATE OR REPLACE FUNCTION public.admin_log_action(_action text, _target_type text DEFAULT NULL::text, _target_id text DEFAULT NULL::text, _details jsonb DEFAULT '{}'::jsonb, _status text DEFAULT 'success'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  INSERT INTO public.admin_audit_logs(admin_id, admin_email, action, target_type, target_id, details, status)
  VALUES (auth.uid(), (SELECT email FROM public.profiles WHERE id = auth.uid()), _action, _target_type, _target_id, COALESCE(_details,'{}'::jsonb), COALESCE(_status,'success'))
  RETURNING id INTO v_id;
  RETURN v_id;
END; $function$;
REVOKE ALL ON FUNCTION public.admin_log_action(text, text, text, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_log_action(text, text, text, jsonb, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_set_user_status(_user_id uuid, _active boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _user_id = auth.uid() THEN RAISE EXCEPTION 'You cannot change your own status'; END IF;
  UPDATE public.profiles SET is_active = _active, updated_at = now() WHERE id = _user_id;
  PERFORM public.admin_log_action(CASE WHEN _active THEN 'user.reactivated' ELSE 'user.suspended' END, 'user', _user_id::text, '{}'::jsonb, 'success');
  RETURN true;
END; $function$;
REVOKE ALL ON FUNCTION public.admin_set_user_status(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_status(uuid, boolean) TO authenticated, service_role;
