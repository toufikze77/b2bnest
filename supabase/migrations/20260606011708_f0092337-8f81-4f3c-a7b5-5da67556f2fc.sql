CREATE TABLE IF NOT EXISTS public.workflow_run_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workflow_id uuid,
  step text NOT NULL,
  status text NOT NULL CHECK (status IN ('ok','error')),
  provider text NOT NULL,
  request_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.workflow_run_logs TO authenticated;
GRANT ALL ON public.workflow_run_logs TO service_role;

ALTER TABLE public.workflow_run_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own run logs"
  ON public.workflow_run_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own run logs"
  ON public.workflow_run_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS workflow_run_logs_user_created_idx
  ON public.workflow_run_logs(user_id, created_at DESC);
