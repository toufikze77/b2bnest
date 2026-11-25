-- =====================================================================================================================
-- Google Calendar sync: one link per task and calendar (calendar_event_links). PREPARED, NOT APPLIED.
-- Read docs/google-calendar-sync/README.md first. One transaction.
--
-- The google-calendar-sync Edge Function (service role) remembers which Google event belongs to which task, and a hash
-- of what it last wrote, so a sync updates an event instead of creating a second one. People never read or write this
-- table: RLS on, no policies, no grants for anon or authenticated (the same protection as user_integrations, whose
-- only policy is "ALL USING (false)" for users). It cascades with the task and with the person (account deletion; the
-- data_rights deletion also deletes every user_id table). "Download my data" includes it (data-rights/tables.ts).
-- Demo read-only: the a0_demo_readonly_guard trigger, like every table in public.
-- The 15-minute catch-up job is docs/google-calendar-sync/schedule.sql (apply it after the function is deployed and
-- the secret is in Vault).
--
-- Production facts (25 Nov 2026, read read-only by the owner's assistant): 160 tables in public, md5 of the names
-- sorted and joined with ',' = b9fec97b9d0d8c836c6af78125e92371; todos.id uuid primary key; demo_readonly_guard()
-- exists; no calendar_event_links. THE OWNER'S ASSISTANT RE-VERIFIES THESE BEFORE APPLYING; anything else: refused.
-- Rollback: rollback.sql. Tests: run-test.sh here.
-- =====================================================================================================================
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.calendar_event_links') IS NOT NULL THEN
    RAISE EXCEPTION 'calendar_event_links already exists (applied twice?)';
  END IF;
  IF (SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind IN ('r', 'p')) <> 160
     OR (SELECT md5(string_agg(relname, ',' ORDER BY relname)) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind IN ('r', 'p'))
        IS DISTINCT FROM 'b9fec97b9d0d8c836c6af78125e92371' THEN
    RAISE EXCEPTION 'the tables in public differ from production as read on 25 Nov 2026 (160 tables)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ALL (c.conkey)
                  WHERE c.conrelid = 'public.todos'::regclass AND c.contype = 'p' AND a.attname = 'id' AND a.atttypid = 'uuid'::regtype) THEN
    RAISE EXCEPTION 'todos.id is not a uuid primary key';
  END IF;
  IF to_regprocedure('public.demo_readonly_guard()') IS NULL THEN
    RAISE EXCEPTION 'demo_readonly_guard() is missing';
  END IF;
END $$;

CREATE TABLE public.calendar_event_links (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.todos(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'google_calendar',
  external_event_id text NOT NULL,
  content_hash text NOT NULL,
  synced_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, task_id, provider)
);
ALTER TABLE public.calendar_event_links ADD CONSTRAINT cel_provider CHECK (provider IN ('google_calendar')),
  ADD CONSTRAINT cel_event_id CHECK (length(external_event_id) BETWEEN 1 AND 1024),
  ADD CONSTRAINT cel_hash CHECK (length(content_hash) BETWEEN 1 AND 200);
CREATE INDEX calendar_event_links_task ON public.calendar_event_links (task_id);
COMMENT ON TABLE public.calendar_event_links IS 'Google Calendar sync: the event made for each task (one per person, task and calendar) and a hash of what was written; content_hash "gone:<hash>" means the event was deleted in Google and is not recreated until the task changes. Service role only (google-calendar-sync).';

ALTER TABLE public.calendar_event_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.calendar_event_links FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_event_links TO service_role;
CREATE TRIGGER a0_demo_readonly_guard BEFORE INSERT OR UPDATE OR DELETE ON public.calendar_event_links FOR EACH ROW EXECUTE FUNCTION public.demo_readonly_guard();

DO $$
BEGIN
  IF has_table_privilege('anon', 'public.calendar_event_links', 'SELECT') OR has_table_privilege('authenticated', 'public.calendar_event_links', 'SELECT')
     OR has_table_privilege('authenticated', 'public.calendar_event_links', 'INSERT') OR NOT has_table_privilege('service_role', 'public.calendar_event_links', 'INSERT')
     OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'calendar_event_links')
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.calendar_event_links'::regclass) THEN
    RAISE EXCEPTION 'calendar_event_links privilege check failed';
  END IF;
END $$;

COMMIT;
