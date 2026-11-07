-- HMRC P4b local fixture: public.organization_members with production's exact columns (read 7 Nov 2026; the earlier
-- local fixtures made organization_id and user_id NOT NULL and used other defaults). Loaded after the HMRC P4 proposal.
BEGIN;
ALTER TABLE public.organization_members
  ALTER COLUMN organization_id DROP NOT NULL, ALTER COLUMN user_id DROP NOT NULL,
  ALTER COLUMN role SET DEFAULT 'member'::text, ALTER COLUMN permissions SET DEFAULT '{}'::jsonb,
  ALTER COLUMN created_at SET NOT NULL, ALTER COLUMN updated_at SET NOT NULL;
COMMIT;
