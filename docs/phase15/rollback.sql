-- Phase 15 rollback: puts public.workflow_run_logs back exactly as it was live on 28 Oct 2026 (policies, status check,
-- grants, columns). The old status check only allows 'ok' and 'error', so rows with 'unknown' or 'skipped' (which only
-- Phase 15 writes) are DELETED first; 'ok' and 'error' rows are kept. One transaction.
BEGIN;
DELETE FROM public.workflow_run_logs WHERE status IN ('unknown', 'skipped');

DROP POLICY IF EXISTS "Users record own skipped steps" ON public.workflow_run_logs;
DROP POLICY IF EXISTS "Users insert own run logs" ON public.workflow_run_logs;
CREATE POLICY "Users insert own run logs" ON public.workflow_run_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP INDEX IF EXISTS public.workflow_run_logs_user_workflow_created_idx;
ALTER TABLE public.workflow_run_logs
  DROP CONSTRAINT IF EXISTS workflow_run_logs_summary_size_check,
  DROP CONSTRAINT IF EXISTS workflow_run_logs_step_index_check,
  DROP CONSTRAINT IF EXISTS workflow_run_logs_status_check;
ALTER TABLE public.workflow_run_logs
  ADD CONSTRAINT workflow_run_logs_status_check CHECK (status = ANY (ARRAY['ok'::text, 'error'::text]));
ALTER TABLE public.workflow_run_logs DROP COLUMN IF EXISTS step_index, DROP COLUMN IF EXISTS run_id;

-- The live grants, restored as they were (broader than needed; see README).
REVOKE ALL ON public.workflow_run_logs FROM anon, authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.workflow_run_logs TO anon, authenticated;
GRANT ALL ON public.workflow_run_logs TO service_role;
COMMIT;
