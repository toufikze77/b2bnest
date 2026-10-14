-- Rollback for proposal.sql. RUN export.sql FIRST and keep its output.
-- DATA LOSS: all saved audiences, campaign drafts and planned-content rows are deleted.
-- Tasks created from planned content stay in the tasks list (they are ordinary tasks).
-- Contacts, deals, notes and tasks are untouched.
BEGIN;
DROP TABLE IF EXISTS public.marketing_content_items;
DROP TABLE IF EXISTS public.marketing_campaigns;
DROP TABLE IF EXISTS public.marketing_audiences;
DROP FUNCTION IF EXISTS public.marketing_guard();
DROP FUNCTION IF EXISTS public.marketing_create_followup_task(uuid, uuid);
COMMIT;
