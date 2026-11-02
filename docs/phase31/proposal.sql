-- =====================================================================================================================
-- Phase 31: Time Tracker saved to the account (PREPARED, NOT APPLIED).
--
-- ORDER: 1. the owner applies this; 2. publish the frontend. Until step 1 the new Time Tracker says it isn't available
-- yet (it needs these columns and functions); nothing else in the app reads or writes this table.
--
-- Reuses public.project_time_entries (created Aug 2025 for project time; 0 rows on 2 Nov 2026, and no code reads or
-- writes it: ProjectTimeTracker.tsx keeps its entries in React state). One table for time, extended:
--   * project_id and task_name become optional (an entry needs a project or a description);
--   * new columns company_id, paused_seconds, paused_at, hourly_rate_pence (GBP pence, the source of truth;
--     hourly_rate (pounds) and duration_minutes are kept in step by a trigger for the project screens);
--   * user_id gets the FK to auth.users ON DELETE CASCADE that sibling tables have;
--   * CHECKs: end >= start, at most 24 hours, pauses within the entry, rate 0..£10,000 an hour, description <= 500;
--   * one running entry per user (partial unique index);
--   * the three old permissive policies (they let any active member of the project's company change anyone's entries)
--     are replaced: you see and change only your own entries; owners / admins of the entry's company can READ their
--     members' entries (the todos / rota pattern); a restrictive policy refuses trial-ended and suspended accounts.
-- New: public.time_tracker_settings (your default rate and billable choice), public.time_tracker_access_ok() and the
-- RPCs time_start / time_pause / time_resume / time_stop / time_summary. The server clock (now()) sets every timer
-- timestamp. Every new SECURITY DEFINER function has the Phase 25 guard line and a guard log row; authenticated only.
--
-- Production facts this was written against (read-only, 2 Nov 2026): project_time_entries columns and policies as in
-- docs/phase31/fixture.sql, 0 rows; md5(prosrc) _access_state_for(uuid) 292e158f87569a1b7bdbe32e64da0a67,
-- mfa_ok() 20516f2ec203220b3ac08d1230c7c306. Anything else: refused.
-- Rollback: docs/phase31/rollback.sql. Tests: docs/phase31/run-test.sh.
-- =====================================================================================================================
BEGIN;

DO $$
DECLARE cols text;
BEGIN
  IF to_regclass('public.time_tracker_settings') IS NOT NULL OR to_regclass('public.phase31_backup') IS NOT NULL THEN
    RAISE EXCEPTION 'Phase 31 already exists (applied twice?)';
  END IF;
  IF to_regclass('public.project_time_entries') IS NULL OR to_regclass('public.phase25_mfa_guard_log') IS NULL THEN
    RAISE EXCEPTION 'project_time_entries / Phase 25 missing';
  END IF;
  SELECT string_agg(column_name || ':' || data_type || ':' || is_nullable, ',' ORDER BY column_name) INTO cols
    FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'project_time_entries';
  IF cols IS DISTINCT FROM 'created_at:timestamp with time zone:NO,description:text:YES,duration_minutes:integer:NO,end_time:timestamp with time zone:YES,hourly_rate:numeric:YES,id:uuid:NO,is_billable:boolean:NO,project_id:uuid:NO,start_time:timestamp with time zone:NO,task_name:text:NO,updated_at:timestamp with time zone:NO,user_id:uuid:NO' THEN
    RAISE EXCEPTION 'project_time_entries is not the shape this was written against: %', cols;
  END IF;
  IF EXISTS (SELECT 1 FROM public.project_time_entries) THEN
    RAISE EXCEPTION 'project_time_entries has rows; this was written for an empty table. Re-read it first.';
  END IF;
  IF (SELECT string_agg(policyname, '|' ORDER BY policyname) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'project_time_entries')
     IS DISTINCT FROM 'Project owners can manage their time entries|Users can manage time entries in their organization projects|Users can view their own time entries|require_aal2_if_enrolled' THEN
    RAISE EXCEPTION 'project_time_entries policies differ from production on 2 Nov 2026';
  END IF;
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public._access_state_for(uuid)')) IS DISTINCT FROM '292e158f87569a1b7bdbe32e64da0a67'
     OR (SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.mfa_ok()')) IS DISTINCT FROM '20516f2ec203220b3ac08d1230c7c306' THEN
    RAISE EXCEPTION '_access_state_for or mfa_ok differs from the body this was written against';
  END IF;
  IF to_regprocedure('public.require_aal2_if_enrolled()') IS NULL OR to_regprocedure('public.user_can_access_project(uuid,uuid)') IS NULL
     OR to_regprocedure('public.user_is_organization_member(uuid,uuid)') IS NULL OR to_regprocedure('public.user_is_organization_admin(uuid,uuid)') IS NULL
     OR to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'a helper this uses is missing';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public'
              AND p.proname IN ('time_start', 'time_pause', 'time_resume', 'time_stop', 'time_summary', 'time_tracker_access_ok', '_time_entry_guard')) THEN
    RAISE EXCEPTION 'a Phase 31 function name is already taken';
  END IF;
END $$;

-- 1. Backup of what rollback.sql restores: the policies (as Postgres prints them) and the table's grants.
CREATE TABLE public.phase31_backup (
  kind text NOT NULL, name text NOT NULL, permissive text, cmd text, roles text[], qual text, with_check text, acl text, privs text[],
  saved_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (kind, name)
);
INSERT INTO public.phase31_backup (kind, name, permissive, cmd, roles, qual, with_check)
SELECT 'policy', policyname, permissive, cmd, roles::text[], qual, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename = 'project_time_entries';
INSERT INTO public.phase31_backup (kind, name, acl, privs)
SELECT 'acl', 'project_time_entries', c.relacl::text,
       ARRAY(SELECT p FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']
                                  || CASE WHEN current_setting('server_version_num')::int >= 170000 THEN ARRAY['MAINTAIN'] ELSE ARRAY[]::text[] END) p
             WHERE has_table_privilege('anon', 'public.project_time_entries', p))
  FROM pg_class c WHERE c.oid = 'public.project_time_entries'::regclass;
ALTER TABLE public.phase31_backup ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.phase31_backup FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.phase31_backup TO service_role;

-- 2. project_time_entries, extended.
ALTER TABLE public.project_time_entries
  ALTER COLUMN project_id DROP NOT NULL,
  ALTER COLUMN task_name DROP NOT NULL,
  ADD COLUMN company_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN paused_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN paused_at timestamptz,
  ADD COLUMN hourly_rate_pence integer,
  ADD CONSTRAINT project_time_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT pte_end_after_start CHECK (end_time IS NULL OR end_time >= start_time),
  ADD CONSTRAINT pte_at_most_24_hours CHECK (end_time IS NULL OR end_time - start_time <= interval '24 hours'),
  ADD CONSTRAINT pte_paused_within CHECK (paused_seconds >= 0 AND (end_time IS NULL OR paused_seconds <= extract(epoch FROM end_time - start_time))),
  ADD CONSTRAINT pte_paused_only_running CHECK (paused_at IS NULL OR (end_time IS NULL AND paused_at >= start_time)),
  ADD CONSTRAINT pte_rate_range CHECK (hourly_rate_pence IS NULL OR hourly_rate_pence BETWEEN 0 AND 1000000),
  ADD CONSTRAINT pte_description_length CHECK (description IS NULL OR char_length(description) <= 500),
  ADD CONSTRAINT pte_project_or_description CHECK (project_id IS NOT NULL OR btrim(COALESCE(description, '')) <> '' OR btrim(COALESCE(task_name, '')) <> '');
COMMENT ON COLUMN public.project_time_entries.hourly_rate_pence IS 'Phase 31: hourly rate in GBP pence (source of truth). hourly_rate (pounds) is kept equal by trigger.';
COMMENT ON COLUMN public.project_time_entries.paused_seconds IS 'Phase 31: seconds paused, not counted as worked.';
CREATE UNIQUE INDEX pte_one_running_per_user ON public.project_time_entries (user_id) WHERE end_time IS NULL;
CREATE INDEX pte_user_start_idx ON public.project_time_entries (user_id, start_time);

-- Table writes (manual entries and edits): the database checks them, whatever the browser sends.
CREATE FUNCTION public._time_entry_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE via_timer boolean := COALESCE(current_setting('app.time_rpc', true), '') = 'on';
        proj_org uuid;
BEGIN
  IF NOT via_timer THEN
    IF TG_OP = 'INSERT' AND NEW.end_time IS NULL THEN
      RAISE EXCEPTION 'TIME_RUNNING_VIA_TIMER_ONLY' USING ERRCODE = '22023', HINT = 'Use Start to begin a running timer.';
    END IF;
    IF TG_OP = 'INSERT' AND NEW.paused_at IS NOT NULL THEN
      RAISE EXCEPTION 'TIME_PAUSE_VIA_TIMER_ONLY' USING ERRCODE = '22023';
    END IF;
    IF TG_OP = 'UPDATE' THEN
      IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
        RAISE EXCEPTION 'TIME_OWNER_FIXED' USING ERRCODE = '22023';
      END IF;
      IF OLD.end_time IS NULL AND (NEW.start_time, NEW.end_time, NEW.paused_seconds, NEW.paused_at)
                                IS DISTINCT FROM (OLD.start_time, OLD.end_time, OLD.paused_seconds, OLD.paused_at) THEN
        RAISE EXCEPTION 'TIME_RUNNING_VIA_TIMER_ONLY' USING ERRCODE = '22023', HINT = 'Stop the timer first.';
      END IF;
      IF NEW.paused_at IS DISTINCT FROM OLD.paused_at THEN
        RAISE EXCEPTION 'TIME_PAUSE_VIA_TIMER_ONLY' USING ERRCODE = '22023';
      END IF;
    END IF;
    IF (TG_OP = 'INSERT' OR (NEW.start_time, NEW.end_time) IS DISTINCT FROM (OLD.start_time, OLD.end_time))
       AND (NEW.start_time > now() OR NEW.end_time > now()) THEN
      RAISE EXCEPTION 'TIME_IN_FUTURE' USING ERRCODE = '22023', HINT = 'Entries cannot be in the future.';
    END IF;
  END IF;
  NEW.description := NULLIF(btrim(COALESCE(NEW.description, '')), '');
  -- An entry on a company project belongs to that company.
  IF NEW.project_id IS NOT NULL THEN
    SELECT p.organization_id INTO proj_org FROM public.projects p WHERE p.id = NEW.project_id;
    IF proj_org IS NOT NULL THEN NEW.company_id := proj_org; END IF;
  END IF;
  -- Pence are the source of truth; the older pounds column and minutes stay in step for the project screens.
  IF NEW.hourly_rate_pence IS NULL AND NEW.hourly_rate IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.hourly_rate IS DISTINCT FROM OLD.hourly_rate) THEN
    NEW.hourly_rate_pence := round(NEW.hourly_rate * 100)::integer;
  END IF;
  NEW.hourly_rate := CASE WHEN NEW.hourly_rate_pence IS NULL THEN NULL ELSE NEW.hourly_rate_pence / 100.0 END;
  NEW.duration_minutes := CASE WHEN NEW.end_time IS NULL THEN 0
    ELSE GREATEST(0, floor((extract(epoch FROM NEW.end_time - NEW.start_time) - NEW.paused_seconds) / 60))::integer END;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public._time_entry_guard() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER time_entry_guard BEFORE INSERT OR UPDATE ON public.project_time_entries
  FOR EACH ROW EXECUTE FUNCTION public._time_entry_guard();

-- 3. Settings for this tool (one row per user).
CREATE TABLE public.time_tracker_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  default_rate_pence integer CHECK (default_rate_pence IS NULL OR default_rate_pence BETWEEN 0 AND 1000000),
  default_billable boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.time_tracker_settings IS 'Phase 31: Time Tracker defaults per user (rate in GBP pence).';

-- 4. Who may use the Time Tracker: the same accounts as the rest of Business Tools (owner, subscribed, trial).
CREATE FUNCTION public.time_tracker_access_ok()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard
  RETURN EXISTS (SELECT 1 FROM public._access_state_for(auth.uid()) s WHERE s.state IN ('owner', 'subscribed', 'trial'));
END;
$function$;

-- 5. Policies.
DROP POLICY "Project owners can manage their time entries" ON public.project_time_entries;
DROP POLICY "Users can manage time entries in their organization projects" ON public.project_time_entries;
DROP POLICY "Users can view their own time entries" ON public.project_time_entries;
CREATE POLICY pte_select_own_or_company_admin ON public.project_time_entries FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (company_id IS NOT NULL AND public.user_is_organization_admin(company_id, (SELECT auth.uid()))));
CREATE POLICY pte_insert_own ON public.project_time_entries FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid())
              AND (company_id IS NULL OR public.user_is_organization_member(company_id, (SELECT auth.uid())))
              AND (project_id IS NULL OR public.user_can_access_project(project_id, (SELECT auth.uid()))));
CREATE POLICY pte_update_own ON public.project_time_entries FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid())
              AND (company_id IS NULL OR public.user_is_organization_member(company_id, (SELECT auth.uid())))
              AND (project_id IS NULL OR public.user_can_access_project(project_id, (SELECT auth.uid()))));
CREATE POLICY pte_delete_own ON public.project_time_entries FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY time_tracker_access ON public.project_time_entries AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.time_tracker_access_ok())) WITH CHECK ((SELECT public.time_tracker_access_ok()));
REVOKE ALL ON public.project_time_entries FROM anon;

ALTER TABLE public.time_tracker_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY tts_own ON public.time_tracker_settings FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY require_aal2_if_enrolled ON public.time_tracker_settings AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY time_tracker_access ON public.time_tracker_settings AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.time_tracker_access_ok())) WITH CHECK ((SELECT public.time_tracker_access_ok()));
REVOKE ALL ON public.time_tracker_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_tracker_settings TO authenticated;
GRANT ALL ON public.time_tracker_settings TO service_role;

-- 6. Timer RPCs. Server time decides every timestamp. They run as the table owner (RLS does not apply inside), so they
-- check the user, access, project and company themselves.
CREATE FUNCTION public.time_start(p_project_id uuid DEFAULT NULL, p_description text DEFAULT NULL, p_billable boolean DEFAULT true,
                                  p_hourly_rate_pence integer DEFAULT NULL, p_company_id uuid DEFAULT NULL)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  uid uuid := auth.uid();
  v_desc text := NULLIF(btrim(COALESCE(p_description, '')), '');
  v_company uuid := p_company_id;
  v_proj RECORD;
  v_row public.project_time_entries;
BEGIN
  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard
  IF uid IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF NOT public.time_tracker_access_ok() THEN RAISE EXCEPTION 'TIME_TRACKER_ACCESS_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_project_id IS NULL AND v_desc IS NULL THEN RAISE EXCEPTION 'TIME_PROJECT_OR_DESCRIPTION_REQUIRED' USING ERRCODE = '22023'; END IF;
  IF char_length(COALESCE(v_desc, '')) > 500 THEN RAISE EXCEPTION 'TIME_DESCRIPTION_TOO_LONG' USING ERRCODE = '22023'; END IF;
  IF p_hourly_rate_pence IS NOT NULL AND (p_hourly_rate_pence < 0 OR p_hourly_rate_pence > 1000000) THEN
    RAISE EXCEPTION 'TIME_RATE_OUT_OF_RANGE' USING ERRCODE = '22023';
  END IF;
  IF p_project_id IS NOT NULL THEN
    SELECT p.id, p.organization_id, p.deleted_at INTO v_proj FROM public.projects p WHERE p.id = p_project_id;
    IF NOT FOUND OR v_proj.deleted_at IS NOT NULL OR NOT public.user_can_access_project(p_project_id, uid) THEN
      RAISE EXCEPTION 'TIME_PROJECT_NOT_FOUND' USING ERRCODE = '42501';
    END IF;
    IF v_proj.organization_id IS NOT NULL THEN v_company := v_proj.organization_id; END IF;
  END IF;
  IF v_company IS NOT NULL AND NOT public.user_is_organization_member(v_company, uid) THEN
    RAISE EXCEPTION 'ORGANIZATION_MEMBERSHIP_REQUIRED' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('time_timer:' || uid::text, 0));
  IF EXISTS (SELECT 1 FROM public.project_time_entries e WHERE e.user_id = uid AND e.end_time IS NULL) THEN
    RAISE EXCEPTION 'TIMER_ALREADY_RUNNING' USING ERRCODE = '23505', HINT = 'Stop the running timer first.';
  END IF;
  PERFORM set_config('app.time_rpc', 'on', true);
  INSERT INTO public.project_time_entries (project_id, user_id, description, start_time, is_billable, hourly_rate_pence, company_id)
  VALUES (p_project_id, uid, v_desc, now(), COALESCE(p_billable, true), p_hourly_rate_pence, v_company)
  RETURNING * INTO v_row;
  PERFORM set_config('app.time_rpc', 'off', true);
  RETURN row_to_json(v_row);
END;
$function$;

CREATE FUNCTION public.time_pause()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE uid uuid := auth.uid(); v_row public.project_time_entries;
BEGIN
  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard
  IF uid IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF NOT public.time_tracker_access_ok() THEN RAISE EXCEPTION 'TIME_TRACKER_ACCESS_REQUIRED' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_row FROM public.project_time_entries WHERE user_id = uid AND end_time IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NO_RUNNING_TIMER' USING ERRCODE = '22023'; END IF;
  IF v_row.paused_at IS NOT NULL THEN RAISE EXCEPTION 'TIMER_ALREADY_PAUSED' USING ERRCODE = '22023'; END IF;
  PERFORM set_config('app.time_rpc', 'on', true);
  UPDATE public.project_time_entries SET paused_at = now() WHERE id = v_row.id RETURNING * INTO v_row;
  PERFORM set_config('app.time_rpc', 'off', true);
  RETURN row_to_json(v_row);
END;
$function$;

CREATE FUNCTION public.time_resume()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE uid uuid := auth.uid(); v_row public.project_time_entries;
BEGIN
  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard
  IF uid IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF NOT public.time_tracker_access_ok() THEN RAISE EXCEPTION 'TIME_TRACKER_ACCESS_REQUIRED' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_row FROM public.project_time_entries WHERE user_id = uid AND end_time IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NO_RUNNING_TIMER' USING ERRCODE = '22023'; END IF;
  IF v_row.paused_at IS NULL THEN RAISE EXCEPTION 'TIMER_NOT_PAUSED' USING ERRCODE = '22023'; END IF;
  PERFORM set_config('app.time_rpc', 'on', true);
  UPDATE public.project_time_entries
     SET paused_seconds = paused_seconds + GREATEST(0, floor(extract(epoch FROM now() - paused_at)))::integer, paused_at = NULL
   WHERE id = v_row.id RETURNING * INTO v_row;
  PERFORM set_config('app.time_rpc', 'off', true);
  RETURN row_to_json(v_row);
END;
$function$;

-- p_ended_at: only for a timer left running ("I stopped at 17:30"); never in the future, never before the start.
CREATE FUNCTION public.time_stop(p_confirm_short boolean DEFAULT false, p_ended_at timestamptz DEFAULT NULL)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  uid uuid := auth.uid();
  v_row public.project_time_entries;
  v_end timestamptz;
  v_paused integer;
  v_worked numeric;
BEGIN
  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard
  IF uid IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF NOT public.time_tracker_access_ok() THEN RAISE EXCEPTION 'TIME_TRACKER_ACCESS_REQUIRED' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_row FROM public.project_time_entries WHERE user_id = uid AND end_time IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NO_RUNNING_TIMER' USING ERRCODE = '22023'; END IF;
  v_end := COALESCE(p_ended_at, now());
  IF v_end > now() THEN RAISE EXCEPTION 'TIME_IN_FUTURE' USING ERRCODE = '22023'; END IF;
  IF v_end < v_row.start_time THEN RAISE EXCEPTION 'TIME_END_BEFORE_START' USING ERRCODE = '22023'; END IF;
  v_paused := v_row.paused_seconds
              + CASE WHEN v_row.paused_at IS NOT NULL THEN GREATEST(0, floor(extract(epoch FROM v_end - v_row.paused_at)))::integer ELSE 0 END;
  v_paused := LEAST(v_paused, floor(extract(epoch FROM v_end - v_row.start_time))::integer);
  IF v_end - v_row.start_time > interval '24 hours' THEN
    RETURN json_build_object('success', false, 'error', 'over_24_hours', 'start_time', v_row.start_time);
  END IF;
  v_worked := extract(epoch FROM v_end - v_row.start_time) - v_paused;
  IF v_worked < 60 AND NOT COALESCE(p_confirm_short, false) THEN
    RETURN json_build_object('success', false, 'needs_confirmation', true, 'worked_seconds', floor(v_worked)::integer);
  END IF;
  PERFORM set_config('app.time_rpc', 'on', true);
  UPDATE public.project_time_entries SET end_time = v_end, paused_seconds = v_paused, paused_at = NULL
   WHERE id = v_row.id RETURNING * INTO v_row;
  PERFORM set_config('app.time_rpc', 'off', true);
  RETURN json_build_object('success', true, 'entry', row_to_json(v_row));
END;
$function$;

-- Totals for the caller's own finished entries that start in [p_from, p_to): by project and by day (UK days).
-- Value = worked hours x rate for billable entries with a rate, rounded to the penny per entry; never guessed.
CREATE FUNCTION public.time_summary(p_from timestamptz, p_to timestamptz)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE uid uuid := auth.uid();
BEGIN
  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard
  IF uid IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF NOT public.time_tracker_access_ok() THEN RAISE EXCEPTION 'TIME_TRACKER_ACCESS_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_to <= p_from OR p_to - p_from > interval '400 days' THEN
    RAISE EXCEPTION 'TIME_RANGE_INVALID' USING ERRCODE = '22023';
  END IF;
  RETURN (
    WITH e AS (
      SELECT t.id, t.project_id, t.is_billable, t.hourly_rate_pence,
             (timezone('Europe/London', t.start_time))::date AS day,
             GREATEST(0, extract(epoch FROM t.end_time - t.start_time) - t.paused_seconds)::bigint AS secs
        FROM public.project_time_entries t
       WHERE t.user_id = uid AND t.end_time IS NOT NULL AND t.start_time >= p_from AND t.start_time < p_to
    ), v AS (
      SELECT e.*, CASE WHEN e.is_billable THEN e.secs ELSE 0 END AS bill_secs,
             CASE WHEN e.is_billable AND e.hourly_rate_pence IS NOT NULL THEN round(e.secs * e.hourly_rate_pence / 3600.0)::bigint ELSE 0 END AS value_pence,
             CASE WHEN e.is_billable AND e.hourly_rate_pence IS NULL THEN e.secs ELSE 0 END AS unrated_secs
        FROM e
    )
    SELECT jsonb_build_object(
      'entries', (SELECT count(*) FROM v),
      'total_seconds', (SELECT COALESCE(sum(secs), 0) FROM v),
      'billable_seconds', (SELECT COALESCE(sum(bill_secs), 0) FROM v),
      'billable_value_pence', (SELECT COALESCE(sum(value_pence), 0) FROM v),
      'unrated_billable_seconds', (SELECT COALESCE(sum(unrated_secs), 0) FROM v),
      'by_project', (SELECT COALESCE(jsonb_agg(x ORDER BY x.seconds DESC, x.project_name), '[]'::jsonb) FROM (
          SELECT v.project_id,
                 CASE WHEN v.project_id IS NULL THEN NULL
                      WHEN public.user_can_access_project(v.project_id, uid) THEN (SELECT p.name FROM public.projects p WHERE p.id = v.project_id) END AS project_name,
                 sum(v.secs) AS seconds, sum(v.bill_secs) AS billable_seconds, sum(v.value_pence) AS value_pence, count(*) AS entries
            FROM v GROUP BY v.project_id) x),
      'by_day', (SELECT COALESCE(jsonb_agg(jsonb_build_object('day', d.day, 'seconds', COALESCE(s.seconds, 0), 'billable_seconds', COALESCE(s.bill, 0),
                                                              'value_pence', COALESCE(s.value_pence, 0)) ORDER BY d.day), '[]'::jsonb)
          FROM (SELECT generate_series(timezone('Europe/London', p_from)::date, (timezone('Europe/London', p_to) - interval '1 microsecond')::date, interval '1 day')::date AS day) d
          LEFT JOIN (SELECT v.day, sum(v.secs) AS seconds, sum(v.bill_secs) AS bill, sum(v.value_pence) AS value_pence FROM v GROUP BY v.day) s ON s.day = d.day)
    )
  );
END;
$function$;

-- Privileges: authenticated only (never anon). time_tracker_access_ok is also called by the policies.
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.time_tracker_access_ok()', 'public.time_start(uuid,text,boolean,integer,uuid)', 'public.time_pause()',
                           'public.time_resume()', 'public.time_stop(boolean,timestamp with time zone)', 'public.time_summary(timestamp with time zone,timestamp with time zone)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, service_role', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
END $$;

-- 7. Phase 25 guard log rows (docs/phase25/rollback.sql strips exactly this line).
DO $$
DECLARE
  snip constant text := E'\n  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard';
  f text; src text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.time_tracker_access_ok()', 'public.time_start(uuid,text,boolean,integer,uuid)', 'public.time_pause()',
                           'public.time_resume()', 'public.time_stop(boolean,timestamp with time zone)', 'public.time_summary(timestamp with time zone,timestamp with time zone)'] LOOP
    SELECT prosrc INTO src FROM pg_proc WHERE oid = to_regprocedure(f);
    IF position(snip in src) = 0 THEN RAISE EXCEPTION '% has no guard line', f; END IF;
    INSERT INTO public.phase25_mfa_guard_log (fn, kind, old_md5, new_md5) VALUES (f, 'user', md5(replace(src, snip, '')), md5(src));
  END LOOP;
END $$;

-- 8. Final checks.
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.time_tracker_access_ok()', 'public.time_start(uuid,text,boolean,integer,uuid)', 'public.time_pause()',
                           'public.time_resume()', 'public.time_stop(boolean,timestamp with time zone)', 'public.time_summary(timestamp with time zone,timestamp with time zone)'] LOOP
    IF has_function_privilege('anon', f, 'EXECUTE') OR NOT has_function_privilege('authenticated', f, 'EXECUTE') THEN
      RAISE EXCEPTION '% privileges are not as intended', f;
    END IF;
  END LOOP;
  IF has_table_privilege('anon', 'public.project_time_entries', 'SELECT') OR has_table_privilege('anon', 'public.time_tracker_settings', 'SELECT') THEN
    RAISE EXCEPTION 'anon can still read time entries';
  END IF;
END $$;

COMMIT;
