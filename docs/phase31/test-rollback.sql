-- Phase 31 rollback tests. run-test.sh runs this after test.sql and after checking rollback.sql refuses without force.
\set ON_ERROR_STOP 1
\i docs/phase37/test-helpers.sql
SET app.phase31_force = 'on';
\i docs/phase31/rollback.sql
RESET app.phase31_force;
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT string_agg(column_name || ':' || data_type || ':' || is_nullable, ',' ORDER BY column_name) FROM information_schema.columns
                       WHERE table_schema = 'public' AND table_name = 'project_time_entries')
    = 'created_at:timestamp with time zone:NO,description:text:YES,duration_minutes:integer:NO,end_time:timestamp with time zone:YES,hourly_rate:numeric:YES,id:uuid:NO,is_billable:boolean:NO,project_id:uuid:NO,start_time:timestamp with time zone:NO,task_name:text:NO,updated_at:timestamp with time zone:NO,user_id:uuid:NO',
    'rollback: columns and NOT NULLs exactly as before');
  PERFORM pg_temp.ok((SELECT string_agg(conname, ',' ORDER BY conname) FROM pg_constraint WHERE conrelid = 'public.project_time_entries'::regclass)
                     = 'project_time_entries_pkey,project_time_entries_project_id_fkey', 'rollback: constraints exactly as before');
  PERFORM pg_temp.ok((SELECT string_agg(indexname, ',' ORDER BY indexname) FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'project_time_entries')
                     = 'idx_project_time_entries_created_at,idx_project_time_entries_project_id,idx_project_time_entries_user_id,project_time_entries_pkey', 'rollback: indexes exactly as before');
  PERFORM pg_temp.ok((SELECT string_agg(tgname, ',') FROM pg_trigger WHERE tgrelid = 'public.project_time_entries'::regclass AND NOT tgisinternal)
                     = 'update_project_time_entries_updated_at', 'rollback: only the original trigger');
  PERFORM pg_temp.ok((SELECT string_agg(policyname || '/' || permissive || '/' || cmd || '/' || roles::text, '|' ORDER BY policyname) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'project_time_entries')
    = 'Project owners can manage their time entries/PERMISSIVE/ALL/{authenticated}|Users can manage time entries in their organization projects/PERMISSIVE/ALL/{public}|Users can view their own time entries/PERMISSIVE/SELECT/{authenticated}|require_aal2_if_enrolled/RESTRICTIVE/ALL/{authenticated}',
    'rollback: the four policies exactly as before');
  PERFORM pg_temp.ok(has_table_privilege('anon', 'public.project_time_entries', 'SELECT') AND NOT has_table_privilege('anon', 'public.project_time_entries', 'INSERT'),
                     'rollback: anon''s grant back as it was');
  PERFORM pg_temp.ok(to_regclass('public.time_tracker_settings') IS NULL AND to_regclass('public.phase31_backup') IS NULL
                     AND to_regprocedure('public.time_start(uuid,text,boolean,integer,uuid)') IS NULL AND to_regprocedure('public.time_tracker_access_ok()') IS NULL
                     AND to_regprocedure('public._time_entry_guard()') IS NULL, 'rollback: new table and functions removed');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.phase25_mfa_guard_log WHERE fn ~ 'time_'), 'rollback: guard log rows removed');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.phase25_mfa_guard_log) > 0, 'rollback: other guard log rows untouched');
END $$;
\echo '== apply again'
\i docs/phase31/proposal.sql
DO $$ BEGIN
  PERFORM pg_temp.ok(to_regclass('public.time_tracker_settings') IS NOT NULL AND (SELECT count(*) FROM public.phase25_mfa_guard_log WHERE fn ~ 'time_') = 6,
                     're-apply after rollback works');
END $$;
