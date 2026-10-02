ALTER TABLE public.staging_cost_test_runs DROP CONSTRAINT IF EXISTS staging_cost_test_runs_id_check;
ALTER TABLE public.staging_cost_test_runs ADD CONSTRAINT staging_cost_test_runs_id_check CHECK (id IN (1, 2));
ALTER TABLE public.staging_cost_test_runs ALTER COLUMN id DROP DEFAULT;