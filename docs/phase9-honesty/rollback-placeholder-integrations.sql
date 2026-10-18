-- Rollback for cleanup-placeholder-integrations.sql: puts the deleted rows back exactly (same ids and values).
-- Skips any row whose id, or whose (user_id, integration_name), exists again (e.g. the user since connected for real).
-- Safe to re-run. Leaves the backup table in place.
BEGIN;
INSERT INTO public.user_integrations
SELECT b.* FROM public.phase9_placeholder_integrations_backup b
WHERE NOT EXISTS (SELECT 1 FROM public.user_integrations ui WHERE ui.id = b.id)
  AND NOT EXISTS (SELECT 1 FROM public.user_integrations ui WHERE ui.user_id = b.user_id AND ui.integration_name = b.integration_name);
COMMIT;
