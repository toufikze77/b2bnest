-- Phase 15: Workflow Studio run history (PREPARED, not applied). One transaction. Touches public.workflow_run_logs only.
--
-- Why:
--  * Run history must never say "Sent" unless the email function reported it. Today any signed-in user may INSERT
--    their own rows with status 'ok', so a browser could write a fake "sent" row. After this, only the server
--    (service role: workflow-send-email, workflow-execute) writes ok / error / unknown; a browser session may only
--    record a step it skipped (status 'skipped', provider 'none').
--  * Statuses 'unknown' (delivery status unknown) and 'skipped' (step not available) are needed, plus run_id and
--    step_index to group a run's steps.
--  * anon and authenticated hold DELETE, UPDATE, TRUNCATE, TRIGGER and REFERENCES on the table they never need.
--    RLS already blocked UPDATE/DELETE (no policy), but TRUNCATE is not covered by RLS. All revoked.
-- Reading is unchanged: a user sees only their own rows ("Users view own run logs", user_id = auth.uid()).
-- No functions are created, so there is no search_path to set.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.workflow_run_logs') IS NULL THEN
    RAISE EXCEPTION 'Phase 15: public.workflow_run_logs is missing; nothing applied';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'workflow_run_logs' AND column_name = 'run_id') THEN
    RAISE EXCEPTION 'Phase 15: workflow_run_logs.run_id already exists (applied twice?)';
  END IF;
END $$;

ALTER TABLE public.workflow_run_logs
  ADD COLUMN run_id uuid,
  ADD COLUMN step_index smallint;

ALTER TABLE public.workflow_run_logs DROP CONSTRAINT workflow_run_logs_status_check;
ALTER TABLE public.workflow_run_logs
  ADD CONSTRAINT workflow_run_logs_status_check CHECK (status IN ('ok', 'error', 'unknown', 'skipped')),
  ADD CONSTRAINT workflow_run_logs_step_index_check CHECK (step_index IS NULL OR step_index BETWEEN 0 AND 9),
  -- Summaries hold counts and short reasons only; this stops anyone storing message bodies here.
  ADD CONSTRAINT workflow_run_logs_summary_size_check
    CHECK (octet_length(request_summary::text) <= 1000 AND octet_length(response_summary::text) <= 2000);

-- Run history reads one workflow's latest runs.
CREATE INDEX workflow_run_logs_user_workflow_created_idx
  ON public.workflow_run_logs (user_id, workflow_id, created_at DESC);

ALTER TABLE public.workflow_run_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.workflow_run_logs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.workflow_run_logs TO authenticated;
GRANT ALL ON public.workflow_run_logs TO service_role;

DROP POLICY "Users insert own run logs" ON public.workflow_run_logs;
CREATE POLICY "Users record own skipped steps" ON public.workflow_run_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'skipped' AND provider = 'none');
-- "Users view own run logs" (SELECT, user_id = auth.uid()) is kept as it is.

COMMIT;
