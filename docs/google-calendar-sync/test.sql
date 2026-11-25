-- Google Calendar sync tests (DISPOSABLE local Postgres only): after proposal.sql. One transaction, rolled back.
-- Fictional people only.
\set ON_ERROR_STOP 1
BEGIN;
\i docs/phase37/test-helpers.sql
INSERT INTO auth.users (id, email) VALUES ('ca100000-0000-4000-8000-000000000001', 'c1@example.test'), ('ca100000-0000-4000-8000-000000000002', 'c2@example.test');
INSERT INTO public.todos (id, user_id, title, status, priority, due_date) VALUES
  ('ca200000-0000-4000-8000-000000000001', 'ca100000-0000-4000-8000-000000000001', 'Send invoice', 'todo', 'high', '2026-12-01'),
  ('ca200000-0000-4000-8000-000000000002', 'ca100000-0000-4000-8000-000000000002', 'Other person', 'todo', 'low', '2026-12-02');

\echo '== shape'
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind IN ('r', 'p')) = 161, '161 tables: one added');
  PERFORM pg_temp.ok((SELECT string_agg(attname || ':' || format_type(atttypid, atttypmod) || ':' || attnotnull, ',' ORDER BY attnum) FROM pg_attribute
    WHERE attrelid = 'public.calendar_event_links'::regclass AND attnum > 0 AND NOT attisdropped)
    = 'user_id:uuid:true,task_id:uuid:true,provider:text:true,external_event_id:text:true,content_hash:text:true,synced_at:timestamp with time zone:false',
    'the columns as specified');
  PERFORM pg_temp.ok((SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'public.calendar_event_links'::regclass AND contype = 'p') = 'PRIMARY KEY (user_id, task_id, provider)',
    'primary key (user_id, task_id, provider)');
  PERFORM pg_temp.ok((SELECT string_agg(pg_get_constraintdef(oid), ' | ' ORDER BY pg_get_constraintdef(oid)) FROM pg_constraint WHERE conrelid = 'public.calendar_event_links'::regclass AND contype = 'f')
    = 'FOREIGN KEY (task_id) REFERENCES todos(id) ON DELETE CASCADE | FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE',
    'cascades with the task and with the person');
  PERFORM pg_temp.ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.calendar_event_links'::regclass)
    AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'calendar_event_links'), 'RLS on, no policies');
  PERFORM pg_temp.ok(NOT has_table_privilege('anon', 'public.calendar_event_links', 'SELECT,INSERT,UPDATE,DELETE')
    AND NOT has_table_privilege('authenticated', 'public.calendar_event_links', 'SELECT,INSERT,UPDATE,DELETE')
    AND has_table_privilege('service_role', 'public.calendar_event_links', 'SELECT') AND has_table_privilege('service_role', 'public.calendar_event_links', 'DELETE'),
    'no grants for anon or authenticated; the service role reads and writes');
  PERFORM pg_temp.ok(EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.calendar_event_links'::regclass AND tgname = 'a0_demo_readonly_guard'), 'the demo guard trigger');
END $$;

\echo '== people cannot read or write it'
INSERT INTO public.calendar_event_links (user_id, task_id, external_event_id, content_hash)
VALUES ('ca100000-0000-4000-8000-000000000001', 'ca200000-0000-4000-8000-000000000001', 'evt1', 'v1:abc');
SELECT set_config('request.jwt.claims', '{"sub": "ca100000-0000-4000-8000-000000000001", "role": "authenticated", "aal": "aal1"}', false);
SET ROLE authenticated;
SELECT pg_temp.fails($q$SELECT * FROM public.calendar_event_links$q$, 'permission denied', 'a signed-in person cannot read even their own links');
SELECT pg_temp.fails($q$INSERT INTO public.calendar_event_links (user_id, task_id, external_event_id, content_hash) VALUES ('ca100000-0000-4000-8000-000000000001', 'ca200000-0000-4000-8000-000000000001', 'x', 'y')$q$,
  'permission denied', 'nor write them');
RESET ROLE;
SET ROLE anon;
SELECT pg_temp.fails($q$SELECT * FROM public.calendar_event_links$q$, 'permission denied', 'anon cannot read it');
RESET ROLE;
SET ROLE service_role;
SELECT pg_temp.ok((SELECT count(*) FROM public.calendar_event_links) = 1, 'the service role reads it');
SELECT pg_temp.fails($q$INSERT INTO public.calendar_event_links (user_id, task_id, external_event_id, content_hash) VALUES ('ca100000-0000-4000-8000-000000000001', 'ca200000-0000-4000-8000-000000000001', 'evt2', 'v1:x')$q$,
  'duplicate key', 'one link per person, task and calendar');
SELECT pg_temp.fails($q$INSERT INTO public.calendar_event_links (user_id, task_id, provider, external_event_id, content_hash) VALUES ('ca100000-0000-4000-8000-000000000001', 'ca200000-0000-4000-8000-000000000001', 'outlook', 'e', 'h')$q$,
  'cel_provider', 'only google_calendar for now');
RESET ROLE;

\echo '== cascades'
INSERT INTO public.calendar_event_links (user_id, task_id, external_event_id, content_hash)
VALUES ('ca100000-0000-4000-8000-000000000002', 'ca200000-0000-4000-8000-000000000002', 'evt9', 'v1:def');
DELETE FROM public.todos WHERE id = 'ca200000-0000-4000-8000-000000000001';
SELECT pg_temp.ok((SELECT count(*) FROM public.calendar_event_links WHERE task_id = 'ca200000-0000-4000-8000-000000000001') = 0
  AND (SELECT count(*) FROM public.calendar_event_links) = 1, 'deleting a task removes its link only');
DELETE FROM auth.users WHERE id = 'ca100000-0000-4000-8000-000000000002';
SELECT pg_temp.ok((SELECT count(*) FROM public.calendar_event_links) = 0, 'deleting the person removes their links');
ROLLBACK;
