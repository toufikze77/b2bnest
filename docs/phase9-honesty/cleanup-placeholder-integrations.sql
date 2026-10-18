-- PREPARED, NOT APPLIED. Needs the owner's approval before it is run on production (gvftvswyrevummbvyhxa).
-- Deletes ONLY user_integrations rows whose stored token decrypts to the literal 'placeholder_token' (fake
-- "Connected" rows written by the removed CRM Integrations / Services tabs). Real connections (real OAuth tokens)
-- are never matched. Every deleted row is first copied to public.phase9_placeholder_integrations_backup so
-- rollback-placeholder-integrations.sql can put them back exactly.
-- Safe to re-run: the copy skips rows already copied, and a second delete finds nothing.
-- Run count-placeholder-integrations.sql before and after; the after-count must be 0 rows.
BEGIN;

CREATE TABLE IF NOT EXISTS public.phase9_placeholder_integrations_backup
  (LIKE public.user_integrations INCLUDING DEFAULTS);
ALTER TABLE public.phase9_placeholder_integrations_backup ENABLE ROW LEVEL SECURITY; -- no policies: service role / owner only
REVOKE ALL ON public.phase9_placeholder_integrations_backup FROM PUBLIC, anon, authenticated;

INSERT INTO public.phase9_placeholder_integrations_backup
SELECT ui.* FROM public.user_integrations ui
WHERE public.decrypt_integration_token(ui.access_token) = 'placeholder_token'
  AND NOT EXISTS (SELECT 1 FROM public.phase9_placeholder_integrations_backup b WHERE b.id = ui.id);

DELETE FROM public.user_integrations ui
WHERE public.decrypt_integration_token(ui.access_token) = 'placeholder_token';

COMMIT;
-- Afterwards, once the owner is satisfied (separate decision): DROP TABLE public.phase9_placeholder_integrations_backup;
