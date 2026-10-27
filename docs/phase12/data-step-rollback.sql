-- Undo data-step.sql: put back the saved flags and drop the backup table.
BEGIN;
UPDATE public.profiles p SET is_trial_active = b.is_trial_active, trial_expired = b.trial_expired
  FROM public.phase12_trial_flags_backup b WHERE b.id = p.id;
DROP TABLE public.phase12_trial_flags_backup;
COMMIT;
