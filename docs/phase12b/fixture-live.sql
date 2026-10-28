-- Phase 12b test fixture: live shape of public.admin_audit_logs read from production on 2026-10-28 (read-only).
-- Loaded by run-test.sh on top of docs/phase12/fixture-live.sql. Never run this on production.
CREATE TABLE public.admin_audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, admin_id uuid NOT NULL, admin_email text, action text NOT NULL,
  target_type text, target_id text, details jsonb NOT NULL DEFAULT '{}'::jsonb, status text NOT NULL DEFAULT 'success',
  created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.admin_audit_logs TO anon, authenticated, service_role; -- live ACL (Supabase default grants)
CREATE POLICY "super admins append audit" ON public.admin_audit_logs FOR INSERT WITH CHECK (public.is_super_admin(auth.uid()) AND admin_id = auth.uid());
CREATE POLICY "super admins read audit" ON public.admin_audit_logs FOR SELECT USING (public.is_super_admin(auth.uid()));
