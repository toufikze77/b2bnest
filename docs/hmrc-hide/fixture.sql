-- HMRC hide switch fixture (DISPOSABLE local Postgres only): gives the local copy of production the shape read on
-- 9 Nov 2026 for what the proposal touches. The earlier fixtures have only a placeholder platform_settings and no
-- admin_log_action. Recreated here: platform_settings (columns, primary key, RLS on, the four production policies, the
-- production grants, the demo guard trigger, the three existing keys with placeholder values), the admin_audit_logs
-- columns admin_log_action writes, and admin_log_action itself (production's exact body; md5 checked by run-test.sh).
\set ON_ERROR_STOP 1
BEGIN;
DROP TABLE public.platform_settings;
CREATE TABLE public.platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_settings FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.platform_settings TO anon;
GRANT ALL ON public.platform_settings TO authenticated, service_role;
CREATE POLICY require_aal2_if_enrolled ON public.platform_settings AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY "super admins insert settings" ON public.platform_settings FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "super admins read settings" ON public.platform_settings FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "super admins update settings" ON public.platform_settings FOR UPDATE TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER a0_demo_readonly_guard BEFORE INSERT OR UPDATE OR DELETE ON public.platform_settings FOR EACH ROW EXECUTE FUNCTION public.demo_readonly_guard();
INSERT INTO public.platform_settings (key, value) VALUES ('platform', '{"name": "Example"}'), ('maintenance_mode', 'false'), ('community_enabled', 'false');

ALTER TABLE public.admin_audit_logs ADD COLUMN IF NOT EXISTS admin_id uuid, ADD COLUMN IF NOT EXISTS admin_email text, ADD COLUMN IF NOT EXISTS action text,
  ADD COLUMN IF NOT EXISTS target_type text, ADD COLUMN IF NOT EXISTS target_id text, ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'success', ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
DO $do$ BEGIN
  EXECUTE $s$CREATE OR REPLACE FUNCTION public.admin_log_action(_action text, _target_type text DEFAULT NULL, _target_id text DEFAULT NULL, _details jsonb DEFAULT '{}'::jsonb, _status text DEFAULT 'success')
    RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $s$ || quote_literal(E'\nDECLARE v_id uuid;\nBEGIN\n  PERFORM public.require_aal2_admin(); -- phase25 mfa guard\n  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION \'Not authorized\'; END IF;\n  INSERT INTO public.admin_audit_logs(admin_id, admin_email, action, target_type, target_id, details, status)\n  VALUES (auth.uid(), (SELECT email FROM public.profiles WHERE id = auth.uid()), _action, _target_type, _target_id, COALESCE(_details,\'{}\'::jsonb), COALESCE(_status,\'success\'))\n  RETURNING id INTO v_id;\n  RETURN v_id;\nEND; ');
END $do$;
REVOKE ALL ON FUNCTION public.admin_log_action(text, text, text, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_log_action(text, text, text, jsonb, text) TO authenticated, service_role;
-- public.user_roles as production has it (read 9 Nov 2026): RLS on, only super admins give or change roles (never
-- super_admin, never their own), and the escalation trigger refuses super_admin through the API.
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins can delete customer roles" ON public.user_roles FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) AND role <> 'super_admin'::public.app_role AND user_id <> auth.uid());
CREATE POLICY "Super admins can insert customer roles" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) AND role <> 'super_admin'::public.app_role AND user_id <> auth.uid());
CREATE POLICY "Super admins can update customer roles" ON public.user_roles FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) AND role <> 'super_admin'::public.app_role AND user_id <> auth.uid())
  WITH CHECK (public.is_super_admin(auth.uid()) AND role <> 'super_admin'::public.app_role AND user_id <> auth.uid());
CREATE POLICY "Super admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY require_aal2_if_enrolled ON public.user_roles AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE FUNCTION public.prevent_super_admin_escalation() RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $f$
BEGIN
  IF NEW.role = 'super_admin'::public.app_role
     AND auth.uid() IS NOT NULL
     AND COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Not authorized: super_admin cannot be assigned through the API';
  END IF;
  RETURN NEW;
END;
$f$;
CREATE TRIGGER trg_prevent_super_admin_escalation BEFORE INSERT OR UPDATE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.prevent_super_admin_escalation();
COMMIT;
