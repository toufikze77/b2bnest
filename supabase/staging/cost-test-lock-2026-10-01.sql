-- Temporary single-run lock + results for the one-off capped OpenAI cost test (2026-10-01).
-- Owner-approved for the LIVE project. Removed after the test (see rollback file).
-- Touches no existing table. Server (service_role) access only.
CREATE TABLE public.staging_cost_test_runs (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),   -- at most one run, ever (atomic lock)
  started_by uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'finished', 'aborted')),
  model text NOT NULL,
  planned_calls int NOT NULL CHECK (planned_calls BETWEEN 1 AND 4),
  max_batch_usd_micros int NOT NULL CHECK (max_batch_usd_micros > 0),
  results jsonb NOT NULL DEFAULT '[]'::jsonb
);
REVOKE ALL ON public.staging_cost_test_runs FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.staging_cost_test_runs TO service_role;
ALTER TABLE public.staging_cost_test_runs ENABLE ROW LEVEL SECURITY;
-- No policies: anon/authenticated have no grants and no policies; only service_role (bypasses RLS) can use it.
