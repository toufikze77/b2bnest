-- =====================================================================================================================
-- Phase 31 rollback (one transaction). Puts public.project_time_entries back exactly as it was on 2 Nov 2026 (columns,
-- NOT NULLs, constraints, the three old policies as Postgres printed them, grants), removes time_tracker_settings, the
-- functions and their Phase 25 guard log rows.
--
-- !!! DATA: the old table cannot hold entries without a project. This REFUSES while any time entry or setting exists,
-- !!! unless you first export them and then run it with   SET LOCAL app.phase31_force = 'on';   (after BEGIN), in which
-- !!! case EVERY time entry and setting is deleted. Publish the previous frontend first.
-- =====================================================================================================================
BEGIN;
DO $$
BEGIN
  IF to_regclass('public.phase31_backup') IS NULL THEN RAISE EXCEPTION 'Phase 31 is not applied'; END IF;
  IF (SELECT count(*) FROM public.phase31_backup WHERE kind = 'policy') <> 4 OR NOT EXISTS (SELECT 1 FROM public.phase31_backup WHERE kind = 'acl') THEN
    RAISE EXCEPTION 'Phase 31 backup is incomplete';
  END IF;
  IF (EXISTS (SELECT 1 FROM public.project_time_entries) OR EXISTS (SELECT 1 FROM public.time_tracker_settings))
     AND COALESCE(current_setting('app.phase31_force', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Customers have time entries (%) or settings (%). Export them first; then SET LOCAL app.phase31_force = ''on'' (this deletes them).',
      (SELECT count(*) FROM public.project_time_entries), (SELECT count(*) FROM public.time_tracker_settings);
  END IF;
END $$;

DELETE FROM public.project_time_entries;

DROP POLICY pte_select_own_or_company_admin ON public.project_time_entries;
DROP POLICY pte_insert_own ON public.project_time_entries;
DROP POLICY pte_update_own ON public.project_time_entries;
DROP POLICY pte_delete_own ON public.project_time_entries;
DROP POLICY time_tracker_access ON public.project_time_entries;
DROP TABLE public.time_tracker_settings;

DROP FUNCTION public.time_summary(timestamptz, timestamptz);
DROP FUNCTION public.time_stop(boolean, timestamptz);
DROP FUNCTION public.time_resume();
DROP FUNCTION public.time_pause();
DROP FUNCTION public.time_start(uuid, text, boolean, integer, uuid);
DROP TRIGGER time_entry_guard ON public.project_time_entries;
DROP FUNCTION public._time_entry_guard();
DROP INDEX public.pte_one_running_per_user;
DROP INDEX public.pte_user_start_idx;
ALTER TABLE public.project_time_entries
  DROP CONSTRAINT pte_end_after_start, DROP CONSTRAINT pte_at_most_24_hours, DROP CONSTRAINT pte_paused_within,
  DROP CONSTRAINT pte_paused_only_running, DROP CONSTRAINT pte_rate_range, DROP CONSTRAINT pte_description_length,
  DROP CONSTRAINT pte_project_or_description, DROP CONSTRAINT project_time_entries_user_id_fkey,
  DROP COLUMN company_id, DROP COLUMN paused_seconds, DROP COLUMN paused_at, DROP COLUMN hourly_rate_pence,
  ALTER COLUMN project_id SET NOT NULL, ALTER COLUMN task_name SET NOT NULL;
DROP FUNCTION public.time_tracker_access_ok();

-- The three old policies, rebuilt from the backup (exactly what Postgres printed), then compared.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM public.phase31_backup WHERE kind = 'policy' AND name <> 'require_aal2_if_enrolled' LOOP
    EXECUTE format('CREATE POLICY %I ON public.project_time_entries AS %s FOR %s TO %s%s%s', r.name, r.permissive, r.cmd,
                   (SELECT string_agg(quote_ident(x), ', ') FROM unnest(r.roles) x),
                   CASE WHEN r.qual IS NULL THEN '' ELSE ' USING (' || r.qual || ')' END,
                   CASE WHEN r.with_check IS NULL THEN '' ELSE ' WITH CHECK (' || r.with_check || ')' END);
  END LOOP;
  IF EXISTS (SELECT name, permissive, cmd, roles, qual, with_check FROM public.phase31_backup WHERE kind = 'policy'
             EXCEPT SELECT policyname, permissive, cmd, roles::text[], qual, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename = 'project_time_entries')
     OR (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'project_time_entries') <> 4 THEN
    RAISE EXCEPTION 'project_time_entries policies did not return to the saved ones';
  END IF;
END $$;

-- Grants: anon's privileges back, then the whole ACL compared with the saved one (as a set).
DO $$
DECLARE r record; p text;
BEGIN
  SELECT * INTO r FROM public.phase31_backup WHERE kind = 'acl';
  FOREACH p IN ARRAY r.privs LOOP EXECUTE format('GRANT %s ON public.project_time_entries TO anon', p); END LOOP;
  IF (SELECT array_agg(x ORDER BY x) FROM unnest((SELECT relacl::text[] FROM pg_class WHERE oid = 'public.project_time_entries'::regclass)) x)
     IS DISTINCT FROM (SELECT array_agg(x ORDER BY x) FROM unnest(r.acl::text[]) x) THEN
    RAISE EXCEPTION 'project_time_entries grants differ from the saved ones';
  END IF;
END $$;

DELETE FROM public.phase25_mfa_guard_log
 WHERE fn IN ('public.time_tracker_access_ok()', 'public.time_start(uuid,text,boolean,integer,uuid)', 'public.time_pause()', 'public.time_resume()',
              'public.time_stop(boolean,timestamp with time zone)', 'public.time_summary(timestamp with time zone,timestamp with time zone)');
DROP TABLE public.phase31_backup;
COMMIT;
