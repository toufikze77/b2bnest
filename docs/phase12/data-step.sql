-- Phase 12 data step — PREPARED, NOT APPLIED. Separate approval. Cosmetic: tidies trial flags that say "active" although
-- the trial has ended (2 profiles on 2026-10-27). Access never reads these flags (my_access_state uses trial_ends_at).
-- Changes only rows whose trial has ended; saves their previous flags first so data-step-rollback.sql restores them exactly.
-- Note: the profiles updated_at trigger also stamps updated_at on the changed rows.
BEGIN;
CREATE TABLE public.phase12_trial_flags_backup (
  id uuid PRIMARY KEY, is_trial_active boolean, trial_expired boolean, saved_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.phase12_trial_flags_backup ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.phase12_trial_flags_backup FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.phase12_trial_flags_backup TO service_role;
INSERT INTO public.phase12_trial_flags_backup(id, is_trial_active, trial_expired)
SELECT p.id, p.is_trial_active, p.trial_expired FROM public.profiles p
 WHERE p.trial_ends_at <= now() AND (p.is_trial_active IS DISTINCT FROM false OR p.trial_expired IS DISTINCT FROM true);
UPDATE public.profiles p SET is_trial_active = false, trial_expired = true
  FROM public.phase12_trial_flags_backup b WHERE b.id = p.id;
COMMIT;
