-- Finance phase 2 fixture (DISPOSABLE local Postgres only): gives the local copy of production the audit_logs columns
-- the posting function writes (production has them, per src/integrations/supabase/types.ts; the earlier fixtures have
-- only a placeholder). Nothing else.
\set ON_ERROR_STOP 1
BEGIN;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS action text, ADD COLUMN IF NOT EXISTS resource_type text,
  ADD COLUMN IF NOT EXISTS resource_id text, ADD COLUMN IF NOT EXISTS details jsonb, ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS user_agent text, ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
COMMIT;
