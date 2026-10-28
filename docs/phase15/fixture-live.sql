-- public.workflow_run_logs exactly as live (read-only, 28 Oct 2026): columns, status check, index, RLS, both policies,
-- and the table grants (anon and authenticated hold DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE).
-- Test harness only (run-test.sh); never run on production.
CREATE TABLE public.workflow_run_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workflow_id uuid,
  step text NOT NULL,
  status text NOT NULL CONSTRAINT workflow_run_logs_status_check CHECK (status = ANY (ARRAY['ok'::text, 'error'::text])),
  provider text NOT NULL,
  request_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workflow_run_logs_user_created_idx ON public.workflow_run_logs USING btree (user_id, created_at DESC);
ALTER TABLE public.workflow_run_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own run logs" ON public.workflow_run_logs AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users view own run logs" ON public.workflow_run_logs AS PERMISSIVE FOR SELECT TO authenticated USING (user_id = auth.uid());
REVOKE ALL ON public.workflow_run_logs FROM anon, authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.workflow_run_logs TO anon, authenticated;
GRANT ALL ON public.workflow_run_logs TO service_role;
