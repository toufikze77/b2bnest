-- Undo data-step.sql: forget the recorded earlier prices (those subscribers then get the new plan's limits).
BEGIN;
DELETE FROM public.platform_plan_prices WHERE note = 'earlier price recorded by phase11b data-step';
COMMIT;
