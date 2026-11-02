-- =====================================================================================================================
-- Phase 32: Rota holiday requests (PREPARED, NOT APPLIED).
--
-- ORDER: 1. the owner applies this; 2. publish the frontend. Until step 1 the Holiday page says it needs a database
-- update and shows no controls; the Rota's employees and shifts work exactly as today.
--
-- What it adds (one transaction; any check failing changes nothing):
--   * public.rota_leave_requests: one row per holiday request. Written ONLY by the functions below (no table writes for
--     users; never hard-deleted by users). CHECKs: end >= start, at most 60 days, valid half days, kinds and statuses,
--     note and reason at most 500. A trigger refuses overlap with the same employee's pending or approved requests
--     (half-day exact: a morning and an afternoon on the same day don't overlap).
--   * public.rota_leave_allowances: optional yearly allowance in days per employee and leave year (0 to 366, to one
--     decimal place), set by managers. No row = no allowance (no balance is shown).
--   * The leave-year start month lives in the existing public.organizations.settings ('leave_year_start_month', 1-12;
--     default January when absent). Set only through leave_settings_set (managers), which records each company's
--     settings before the first change so rollback.sql restores them exactly.
--   * Employees and users: rota_employees.user_id already exists (FK to profiles, ON DELETE SET NULL; 0 of 2 rows
--     linked on 2 Nov 2026). The only change to the table is a partial unique index: one employee row per user per
--     company. Managers link a member with rota_employee_link (the member must be an active member of that company);
--     leave_link_candidates suggests an employee only when exactly one unlinked employee in the company has the
--     member's email (a suggestion the manager confirms, never an automatic link).
--   * Managers = owners and admins of the company (user_is_organization_admin), checked in the database. Staff = any
--     active member linked to an employee row.
--   * Access: owner, subscribed (own or via company) and trial accounts (leave_access_ok, as the Time Tracker);
--     trial-ended and suspended are refused by the policies and by every function. Phase 25 aal2 policy + guard lines.
--   * Working days: Monday to Friday (the rota stores no working pattern). Bank holidays are NOT subtracted (there is no
--     bank-holiday data in the database).
--
-- Production facts this was written against (read-only, 2 Nov 2026): md5(prosrc) _access_state_for 292e158f…,
-- mfa_ok 20516f2e…, require_aal2_if_enrolled 10b2ae7b…, user_is_organization_admin c6dd6285…,
-- user_is_organization_member 1fb55538…, handle_updated_at da5ac28a…; rota_employees / rota_shifts as in
-- docs/phase32/fixture.sql. Anything else: refused. Rollback: docs/phase32/rollback.sql. Tests: docs/phase32/run-test.sh.
-- =====================================================================================================================
BEGIN;

DO $$
DECLARE cols text;
BEGIN
  IF to_regclass('public.rota_leave_requests') IS NOT NULL OR to_regclass('public.phase32_backup') IS NOT NULL THEN
    RAISE EXCEPTION 'Phase 32 already exists (applied twice?)';
  END IF;
  IF to_regclass('public.rota_employees') IS NULL OR to_regclass('public.phase25_mfa_guard_log') IS NULL OR to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'rota / organisations / Phase 25 missing';
  END IF;
  SELECT string_agg(column_name || ':' || data_type || ':' || is_nullable, ',' ORDER BY column_name) INTO cols
    FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rota_employees';
  IF cols IS DISTINCT FROM 'color:text:YES,contracted_hours:numeric:YES,created_at:timestamp with time zone:NO,created_by:uuid:YES,email:text:YES,full_name:text:NO,id:uuid:NO,is_active:boolean:NO,job_title:text:YES,organization_id:uuid:NO,pay_rate_pence:integer:YES,updated_at:timestamp with time zone:NO,user_id:uuid:YES' THEN
    RAISE EXCEPTION 'rota_employees is not the shape this was written against: %', cols;
  END IF;
  IF (SELECT string_agg(policyname, '|' ORDER BY policyname) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'rota_employees')
     IS DISTINCT FROM 'require_aal2_if_enrolled|rota_employees_delete_admins|rota_employees_insert_admins|rota_employees_select_org_members|rota_employees_update_admins' THEN
    RAISE EXCEPTION 'rota_employees policies differ from production on 2 Nov 2026';
  END IF;
  IF (SELECT string_agg(indexname, ',' ORDER BY indexname) FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'rota_employees')
     IS DISTINCT FROM 'rota_employees_org_idx,rota_employees_pkey' THEN
    RAISE EXCEPTION 'rota_employees indexes differ from production on 2 Nov 2026';
  END IF;
  IF EXISTS (SELECT 1 FROM public.rota_employees WHERE user_id IS NOT NULL GROUP BY organization_id, user_id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'a user is linked to two employee rows in one company; fix that first';
  END IF;
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public._access_state_for(uuid)')) IS DISTINCT FROM '292e158f87569a1b7bdbe32e64da0a67'
     OR (SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.mfa_ok()')) IS DISTINCT FROM '20516f2ec203220b3ac08d1230c7c306'
     OR (SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.require_aal2_if_enrolled()')) IS DISTINCT FROM '10b2ae7bd2f9a94ea20598f19b8aebf2'
     OR (SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.user_is_organization_admin(uuid,uuid)')) IS DISTINCT FROM 'c6dd628541413ec82565a6676a55a767'
     OR (SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.user_is_organization_member(uuid,uuid)')) IS DISTINCT FROM '1fb55538d44b2451875f8baf1b6e4388' THEN
    RAISE EXCEPTION 'a helper differs from the body this was written against';
  END IF;
  IF EXISTS (SELECT 1 FROM public.organizations WHERE jsonb_typeof(settings) = 'object' AND settings ? 'leave_year_start_month') THEN
    RAISE EXCEPTION 'organizations.settings already holds leave_year_start_month';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public'
              AND p.proname ~ '^(leave_|_leave_|rota_employee_link$)') THEN
    RAISE EXCEPTION 'a Phase 32 function name is already taken';
  END IF;
END $$;

-- 1. What rollback.sql needs to put things back exactly: a company's settings before leave_settings_set first changes
--    them ('settings'), and an employee's user_id before rota_employee_link first changes it ('link'). value = {"v": before}.
CREATE TABLE public.phase32_backup (
  kind text NOT NULL CHECK (kind IN ('settings', 'link')), key uuid NOT NULL, value jsonb NOT NULL,
  saved_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (kind, key)
);
ALTER TABLE public.phase32_backup ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.phase32_backup FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.phase32_backup TO service_role;

-- 2. One employee row per user per company (the link staff need to ask for holiday).
CREATE UNIQUE INDEX rota_employees_org_user_uniq ON public.rota_employees (organization_id, user_id) WHERE user_id IS NOT NULL;

-- 3. Requests.
CREATE TABLE public.rota_leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.rota_employees(id) ON DELETE CASCADE,
  requester_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  start_half text NOT NULL DEFAULT 'full',
  end_half text NOT NULL DEFAULT 'full',
  kind text NOT NULL DEFAULT 'annual' CHECK (kind IN ('annual', 'unpaid', 'other')),
  note text CHECK (note IS NULL OR char_length(note) <= 500),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'cancelled')),
  change_requested boolean NOT NULL DEFAULT false,
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  decision_note text CHECK (decision_note IS NULL OR char_length(decision_note) <= 500),
  cancelled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rlr_end_after_start CHECK (end_date >= start_date),
  CONSTRAINT rlr_at_most_60_days CHECK (end_date - start_date <= 59),
  -- One day: full, morning or afternoon (both halves the same). Several days: start full or afternoon, end full or morning.
  CONSTRAINT rlr_halves CHECK (start_half IN ('full', 'am', 'pm') AND end_half IN ('full', 'am', 'pm') AND (
    (start_date = end_date AND start_half = end_half) OR (start_date < end_date AND start_half IN ('full', 'pm') AND end_half IN ('full', 'am')))),
  CONSTRAINT rlr_change_only_declined CHECK (NOT change_requested OR status = 'declined'),
  CONSTRAINT rlr_decided CHECK ((status IN ('approved', 'declined')) = (decided_at IS NOT NULL) OR status = 'cancelled')
);
COMMENT ON TABLE public.rota_leave_requests IS 'Phase 32: rota holiday requests. Written only by the leave_* functions.';
CREATE INDEX rota_leave_requests_company_dates_idx ON public.rota_leave_requests (company_id, start_date, end_date);
CREATE INDEX rota_leave_requests_employee_idx ON public.rota_leave_requests (employee_id, start_date);

-- Half-day slots: a morning and an afternoon of one day are different slots.
CREATE FUNCTION public._leave_slot_from(d date, half text) RETURNS integer LANGUAGE sql IMMUTABLE SET search_path TO ''
  AS $$ SELECT (d - DATE '2000-01-01') * 2 + CASE WHEN half = 'pm' THEN 1 ELSE 0 END $$;
CREATE FUNCTION public._leave_slot_to(d date, half text) RETURNS integer LANGUAGE sql IMMUTABLE SET search_path TO ''
  AS $$ SELECT (d - DATE '2000-01-01') * 2 + CASE WHEN half = 'am' THEN 0 ELSE 1 END $$;

CREATE FUNCTION public._leave_request_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at := now();
  IF NEW.status IN ('pending', 'approved') THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('rota_leave:' || NEW.employee_id::text, 0));
    IF EXISTS (SELECT 1 FROM public.rota_leave_requests r
                WHERE r.employee_id = NEW.employee_id AND r.id <> NEW.id AND r.status IN ('pending', 'approved')
                  AND public._leave_slot_from(r.start_date, r.start_half) <= public._leave_slot_to(NEW.end_date, NEW.end_half)
                  AND public._leave_slot_from(NEW.start_date, NEW.start_half) <= public._leave_slot_to(r.end_date, r.end_half)) THEN
      RAISE EXCEPTION 'LEAVE_OVERLAP' USING ERRCODE = '23P01', HINT = 'This person already has a pending or approved request on these days.';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER rota_leave_request_guard BEFORE INSERT OR UPDATE ON public.rota_leave_requests
  FOR EACH ROW EXECUTE FUNCTION public._leave_request_guard();

-- Working days between two dates, Monday to Friday, with half days, counted only inside [p_from, p_to).
CREATE FUNCTION public._leave_working_days(p_start date, p_end date, p_start_half text, p_end_half text, p_from date, p_to date)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  SELECT COALESCE(sum(CASE
           WHEN p_start = p_end THEN CASE WHEN p_start_half = 'full' THEN 1.0 ELSE 0.5 END
           WHEN d = p_start AND p_start_half <> 'full' THEN 0.5
           WHEN d = p_end AND p_end_half <> 'full' THEN 0.5
           ELSE 1.0 END), 0)::numeric(6,1)
    FROM (SELECT g::date AS d FROM generate_series(GREATEST(p_start, p_from), LEAST(p_end, p_to - 1), interval '1 day') g) x
   WHERE extract(isodow FROM x.d) <= 5
$function$;

-- 4. Allowances.
CREATE TABLE public.rota_leave_allowances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.rota_employees(id) ON DELETE CASCADE,
  leave_year integer NOT NULL CHECK (leave_year BETWEEN 2000 AND 2100),
  days numeric(5,1) NOT NULL CHECK (days BETWEEN 0 AND 366),
  set_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, leave_year)
);
COMMENT ON TABLE public.rota_leave_allowances IS 'Phase 32: optional yearly holiday allowance in days. leave_year = the calendar year the leave year starts in.';
-- The company always comes from the employee row (never from the browser).
CREATE FUNCTION public._leave_allowance_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  SELECT e.organization_id INTO NEW.company_id FROM public.rota_employees e WHERE e.id = NEW.employee_id;
  IF NEW.company_id IS NULL THEN RAISE EXCEPTION 'LEAVE_EMPLOYEE_NOT_FOUND' USING ERRCODE = '42501'; END IF;
  NEW.set_by := auth.uid();
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;
CREATE TRIGGER rota_leave_allowance_guard BEFORE INSERT OR UPDATE ON public.rota_leave_allowances
  FOR EACH ROW EXECUTE FUNCTION public._leave_allowance_guard();
REVOKE ALL ON FUNCTION public._leave_request_guard(), public._leave_allowance_guard(), public._leave_slot_from(date, text), public._leave_slot_to(date, text),
  public._leave_working_days(date, date, text, text, date, date) FROM PUBLIC, anon, authenticated;

-- 5. Who may use holiday requests: the same accounts as the Time Tracker (owner, subscribed, trial).
CREATE FUNCTION public.leave_access_ok()
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

-- 6. RLS. Requests: staff read their own (their employee row, or ones they asked for); managers read their company's.
--    Nobody writes the table directly. Allowances: managers read and write their company's; staff read their own.
ALTER TABLE public.rota_leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY rlr_select_own_or_manager ON public.rota_leave_requests FOR SELECT TO authenticated
  USING (public.user_is_organization_admin(company_id, (SELECT auth.uid()))
         OR requester_user_id = (SELECT auth.uid())
         OR EXISTS (SELECT 1 FROM public.rota_employees e WHERE e.id = employee_id AND e.user_id = (SELECT auth.uid())
                    AND public.user_is_organization_member(e.organization_id, (SELECT auth.uid()))));
CREATE POLICY require_aal2_if_enrolled ON public.rota_leave_requests AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY leave_access ON public.rota_leave_requests AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.leave_access_ok())) WITH CHECK ((SELECT public.leave_access_ok()));
REVOKE ALL ON public.rota_leave_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.rota_leave_requests TO authenticated;
GRANT ALL ON public.rota_leave_requests TO service_role;

ALTER TABLE public.rota_leave_allowances ENABLE ROW LEVEL SECURITY;
CREATE POLICY rla_select_own_or_manager ON public.rota_leave_allowances FOR SELECT TO authenticated
  USING (public.user_is_organization_admin(company_id, (SELECT auth.uid()))
         OR EXISTS (SELECT 1 FROM public.rota_employees e WHERE e.id = employee_id AND e.user_id = (SELECT auth.uid())
                    AND public.user_is_organization_member(e.organization_id, (SELECT auth.uid()))));
CREATE POLICY rla_insert_manager ON public.rota_leave_allowances FOR INSERT TO authenticated
  WITH CHECK (public.user_is_organization_admin(company_id, (SELECT auth.uid())));
CREATE POLICY rla_update_manager ON public.rota_leave_allowances FOR UPDATE TO authenticated
  USING (public.user_is_organization_admin(company_id, (SELECT auth.uid()))) WITH CHECK (public.user_is_organization_admin(company_id, (SELECT auth.uid())));
CREATE POLICY rla_delete_manager ON public.rota_leave_allowances FOR DELETE TO authenticated
  USING (public.user_is_organization_admin(company_id, (SELECT auth.uid())));
CREATE POLICY require_aal2_if_enrolled ON public.rota_leave_allowances AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY leave_access ON public.rota_leave_allowances AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.leave_access_ok())) WITH CHECK ((SELECT public.leave_access_ok()));
REVOKE ALL ON public.rota_leave_allowances FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rota_leave_allowances TO authenticated;
GRANT ALL ON public.rota_leave_allowances TO service_role;

-- 7. Functions. They run as the table owner, so each checks the caller, access and company itself.
CREATE FUNCTION public.leave_request_create(p_employee_id uuid, p_start date, p_end date, p_start_half text DEFAULT 'full',
                                            p_end_half text DEFAULT 'full', p_kind text DEFAULT 'annual', p_note text DEFAULT NULL)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  uid uuid := auth.uid();
  v_emp RECORD;
  v_manager boolean;
  v_today date := (now() AT TIME ZONE 'Europe/London')::date;
  v_note text := NULLIF(btrim(COALESCE(p_note, '')), '');
  v_row public.rota_leave_requests;
BEGIN
  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard
  IF uid IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF NOT public.leave_access_ok() THEN RAISE EXCEPTION 'LEAVE_ACCESS_REQUIRED' USING ERRCODE = '42501'; END IF;
  SELECT e.id, e.organization_id, e.user_id, e.is_active INTO v_emp FROM public.rota_employees e WHERE e.id = p_employee_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'LEAVE_EMPLOYEE_NOT_FOUND' USING ERRCODE = '42501'; END IF;
  v_manager := public.user_is_organization_admin(v_emp.organization_id, uid);
  IF NOT v_manager AND NOT (v_emp.user_id = uid AND public.user_is_organization_member(v_emp.organization_id, uid)) THEN
    RAISE EXCEPTION 'LEAVE_EMPLOYEE_NOT_FOUND' USING ERRCODE = '42501';
  END IF;
  IF NOT v_emp.is_active THEN RAISE EXCEPTION 'LEAVE_EMPLOYEE_ARCHIVED' USING ERRCODE = '22023'; END IF;
  IF p_start IS NULL OR p_end IS NULL OR p_end < p_start THEN RAISE EXCEPTION 'LEAVE_DATES_INVALID' USING ERRCODE = '22023'; END IF;
  IF p_end - p_start > 59 THEN RAISE EXCEPTION 'LEAVE_TOO_LONG' USING ERRCODE = '22023'; END IF;
  IF p_start < v_today AND NOT v_manager THEN RAISE EXCEPTION 'LEAVE_IN_PAST' USING ERRCODE = '22023'; END IF;
  IF char_length(COALESCE(v_note, '')) > 500 THEN RAISE EXCEPTION 'LEAVE_NOTE_TOO_LONG' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.rota_leave_requests (company_id, employee_id, requester_user_id, start_date, end_date, start_half, end_half, kind, note)
  VALUES (v_emp.organization_id, v_emp.id, uid, p_start, p_end, COALESCE(p_start_half, 'full'), COALESCE(p_end_half, 'full'), COALESCE(p_kind, 'annual'), v_note)
  RETURNING * INTO v_row;
  RETURN row_to_json(v_row);
END;
$function$;

-- p_decision: 'approve', 'decline' or 'change' (decline and ask for a changed request). Managers only; a manager can't
-- decide their own request unless they are the company owner (nobody is above them).
CREATE FUNCTION public.leave_request_decide(p_request_id uuid, p_decision text, p_note text DEFAULT NULL)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  uid uuid := auth.uid();
  v_req public.rota_leave_requests;
  v_note text := NULLIF(btrim(COALESCE(p_note, '')), '');
  v_own boolean;
BEGIN
  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard
  IF uid IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF NOT public.leave_access_ok() THEN RAISE EXCEPTION 'LEAVE_ACCESS_REQUIRED' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_req FROM public.rota_leave_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND OR NOT public.user_is_organization_admin(v_req.company_id, uid) THEN
    RAISE EXCEPTION 'LEAVE_MANAGER_ONLY' USING ERRCODE = '42501';
  END IF;
  SELECT EXISTS (SELECT 1 FROM public.rota_employees e WHERE e.id = v_req.employee_id AND e.user_id = uid) INTO v_own;
  IF v_own AND NOT EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id = v_req.company_id AND m.user_id = uid AND m.role = 'owner' AND m.is_active) THEN
    RAISE EXCEPTION 'LEAVE_OWN_REQUEST' USING ERRCODE = '42501';
  END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'LEAVE_ALREADY_DECIDED' USING ERRCODE = '22023'; END IF;
  IF p_decision NOT IN ('approve', 'decline', 'change') THEN RAISE EXCEPTION 'LEAVE_DECISION_INVALID' USING ERRCODE = '22023'; END IF;
  IF char_length(COALESCE(v_note, '')) > 500 THEN RAISE EXCEPTION 'LEAVE_NOTE_TOO_LONG' USING ERRCODE = '22023'; END IF;
  UPDATE public.rota_leave_requests
     SET status = CASE WHEN p_decision = 'approve' THEN 'approved' ELSE 'declined' END,
         change_requested = (p_decision = 'change'), decided_by = uid, decided_at = now(), decision_note = v_note
   WHERE id = v_req.id RETURNING * INTO v_req;
  RETURN row_to_json(v_req);
END;
$function$;

-- Staff: their own pending request at any time, or an approved one before it starts. Managers: any pending or approved
-- request of their company. A cancelled request stays (never deleted).
CREATE FUNCTION public.leave_request_cancel(p_request_id uuid, p_note text DEFAULT NULL)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  uid uuid := auth.uid();
  v_req public.rota_leave_requests;
  v_manager boolean;
  v_mine boolean;
  v_today date := (now() AT TIME ZONE 'Europe/London')::date;
  v_note text := NULLIF(btrim(COALESCE(p_note, '')), '');
BEGIN
  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard
  IF uid IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF NOT public.leave_access_ok() THEN RAISE EXCEPTION 'LEAVE_ACCESS_REQUIRED' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_req FROM public.rota_leave_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'LEAVE_NOT_FOUND' USING ERRCODE = '42501'; END IF;
  v_manager := public.user_is_organization_admin(v_req.company_id, uid);
  v_mine := EXISTS (SELECT 1 FROM public.rota_employees e WHERE e.id = v_req.employee_id AND e.user_id = uid
                     AND public.user_is_organization_member(e.organization_id, uid));
  IF NOT v_manager AND NOT v_mine THEN RAISE EXCEPTION 'LEAVE_NOT_FOUND' USING ERRCODE = '42501'; END IF;
  IF v_req.status NOT IN ('pending', 'approved') THEN RAISE EXCEPTION 'LEAVE_NOT_CANCELLABLE' USING ERRCODE = '22023'; END IF;
  IF NOT v_manager AND v_req.status = 'approved' AND v_req.start_date <= v_today THEN
    RAISE EXCEPTION 'LEAVE_ALREADY_STARTED' USING ERRCODE = '22023', HINT = 'Ask a manager to cancel holiday that has started.';
  END IF;
  IF char_length(COALESCE(v_note, '')) > 500 THEN RAISE EXCEPTION 'LEAVE_NOTE_TOO_LONG' USING ERRCODE = '22023'; END IF;
  UPDATE public.rota_leave_requests
     SET status = 'cancelled', cancelled_by = uid, cancelled_at = now(),
         decision_note = CASE WHEN v_manager AND v_note IS NOT NULL THEN v_note ELSE decision_note END
   WHERE id = v_req.id RETURNING * INTO v_req;
  RETURN row_to_json(v_req);
END;
$function$;

-- Balance for one employee and leave year (annual holiday only; Monday to Friday; bank holidays not subtracted).
-- No allowance set: allowance_days and remaining are null (never invented).
CREATE FUNCTION public.leave_balance(p_employee_id uuid, p_leave_year integer DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  uid uuid := auth.uid();
  v_emp RECORD;
  v_month integer;
  v_today date := (now() AT TIME ZONE 'Europe/London')::date;
  v_year integer;
  v_from date; v_to date;
  v_allow numeric;
  v_used numeric; v_pending numeric;
BEGIN
  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard
  IF uid IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF NOT public.leave_access_ok() THEN RAISE EXCEPTION 'LEAVE_ACCESS_REQUIRED' USING ERRCODE = '42501'; END IF;
  SELECT e.id, e.organization_id, e.user_id INTO v_emp FROM public.rota_employees e WHERE e.id = p_employee_id;
  IF NOT FOUND OR NOT (public.user_is_organization_admin(v_emp.organization_id, uid)
                       OR (v_emp.user_id = uid AND public.user_is_organization_member(v_emp.organization_id, uid))) THEN
    RAISE EXCEPTION 'LEAVE_EMPLOYEE_NOT_FOUND' USING ERRCODE = '42501';
  END IF;
  SELECT CASE WHEN (o.settings ->> 'leave_year_start_month') ~ '^([1-9]|1[0-2])$' THEN (o.settings ->> 'leave_year_start_month')::integer ELSE 1 END
    INTO v_month FROM public.organizations o WHERE o.id = v_emp.organization_id;
  v_month := COALESCE(v_month, 1);
  v_year := COALESCE(p_leave_year, CASE WHEN extract(month FROM v_today) >= v_month THEN extract(year FROM v_today)::integer ELSE extract(year FROM v_today)::integer - 1 END);
  IF v_year < 2000 OR v_year > 2100 THEN RAISE EXCEPTION 'LEAVE_YEAR_INVALID' USING ERRCODE = '22023'; END IF;
  v_from := make_date(v_year, v_month, 1);
  v_to := (v_from + interval '1 year')::date;
  SELECT a.days INTO v_allow FROM public.rota_leave_allowances a WHERE a.employee_id = v_emp.id AND a.leave_year = v_year;
  SELECT COALESCE(sum(public._leave_working_days(r.start_date, r.end_date, r.start_half, r.end_half, v_from, v_to)) FILTER (WHERE r.status = 'approved'), 0),
         COALESCE(sum(public._leave_working_days(r.start_date, r.end_date, r.start_half, r.end_half, v_from, v_to)) FILTER (WHERE r.status = 'pending'), 0)
    INTO v_used, v_pending
    FROM public.rota_leave_requests r
   WHERE r.employee_id = v_emp.id AND r.kind = 'annual' AND r.status IN ('approved', 'pending') AND r.start_date < v_to AND r.end_date >= v_from;
  RETURN jsonb_build_object('employee_id', v_emp.id, 'leave_year', v_year, 'start_month', v_month, 'year_start', v_from, 'year_end', v_to - 1,
    'allowance_days', v_allow, 'used_days', v_used, 'pending_days', v_pending,
    'remaining_days', CASE WHEN v_allow IS NULL THEN NULL ELSE v_allow - v_used - v_pending END, 'working_days', 'mon_fri');
END;
$function$;

-- Approved holiday for a company in [p_from, p_to]: name and dates only (no notes, reasons or allowances).
CREATE FUNCTION public.leave_calendar(p_company_id uuid, p_from date, p_to date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE uid uuid := auth.uid();
BEGIN
  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard
  IF uid IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF NOT public.leave_access_ok() THEN RAISE EXCEPTION 'LEAVE_ACCESS_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF NOT public.user_is_organization_member(p_company_id, uid) THEN RAISE EXCEPTION 'ORGANIZATION_MEMBERSHIP_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_to < p_from OR p_to - p_from > 400 THEN RAISE EXCEPTION 'LEAVE_RANGE_INVALID' USING ERRCODE = '22023'; END IF;
  RETURN (SELECT COALESCE(jsonb_agg(jsonb_build_object('request_id', r.id, 'employee_id', r.employee_id, 'full_name', e.full_name,
            'start_date', r.start_date, 'end_date', r.end_date, 'start_half', r.start_half, 'end_half', r.end_half)
            ORDER BY r.start_date, e.full_name), '[]'::jsonb)
    FROM public.rota_leave_requests r JOIN public.rota_employees e ON e.id = r.employee_id
   WHERE r.company_id = p_company_id AND r.status = 'approved' AND r.start_date <= p_to AND r.end_date >= p_from);
END;
$function$;

-- Managers: the leave-year start month (1 = January) in organizations.settings.
CREATE FUNCTION public.leave_settings_set(p_company_id uuid, p_start_month integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE uid uuid := auth.uid(); v jsonb;
BEGIN
  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard
  IF uid IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF NOT public.leave_access_ok() THEN RAISE EXCEPTION 'LEAVE_ACCESS_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF NOT public.user_is_organization_admin(p_company_id, uid) THEN RAISE EXCEPTION 'LEAVE_MANAGER_ONLY' USING ERRCODE = '42501'; END IF;
  IF p_start_month IS NULL OR p_start_month NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'LEAVE_MONTH_INVALID' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.phase32_backup (kind, key, value)
  SELECT 'settings', o.id, jsonb_build_object('v', o.settings) FROM public.organizations o WHERE o.id = p_company_id ON CONFLICT (kind, key) DO NOTHING;
  UPDATE public.organizations
     SET settings = CASE WHEN jsonb_typeof(settings) = 'object' THEN settings ELSE '{}'::jsonb END || jsonb_build_object('leave_year_start_month', p_start_month)
   WHERE id = p_company_id RETURNING settings INTO v;
  RETURN jsonb_build_object('leave_year_start_month', (v ->> 'leave_year_start_month')::integer);
END;
$function$;

-- Managers: link an employee row to a member of the same company (NULL unlinks).
CREATE FUNCTION public.rota_employee_link(p_employee_id uuid, p_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE uid uuid := auth.uid(); v_emp RECORD;
BEGIN
  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard
  IF uid IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF NOT public.leave_access_ok() THEN RAISE EXCEPTION 'LEAVE_ACCESS_REQUIRED' USING ERRCODE = '42501'; END IF;
  SELECT e.id, e.organization_id INTO v_emp FROM public.rota_employees e WHERE e.id = p_employee_id FOR UPDATE;
  IF NOT FOUND OR NOT public.user_is_organization_admin(v_emp.organization_id, uid) THEN RAISE EXCEPTION 'LEAVE_MANAGER_ONLY' USING ERRCODE = '42501'; END IF;
  IF p_user_id IS NOT NULL AND NOT public.user_is_organization_member(v_emp.organization_id, p_user_id) THEN
    RAISE EXCEPTION 'ORGANIZATION_MEMBERSHIP_REQUIRED' USING ERRCODE = '42501', HINT = 'Only an active member of this company can be linked.';
  END IF;
  INSERT INTO public.phase32_backup (kind, key, value)
  SELECT 'link', e.id, jsonb_build_object('v', e.user_id) FROM public.rota_employees e WHERE e.id = v_emp.id ON CONFLICT (kind, key) DO NOTHING;
  BEGIN
    UPDATE public.rota_employees SET user_id = p_user_id WHERE id = v_emp.id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'LEAVE_MEMBER_ALREADY_LINKED' USING ERRCODE = '23505', HINT = 'This member is already linked to another employee.';
  END;
  RETURN json_build_object('employee_id', v_emp.id, 'user_id', p_user_id);
END;
$function$;

-- Managers: the company's members, which employee each is linked to, and a suggestion only where exactly one unlinked
-- employee of the company has the member's email.
CREATE FUNCTION public.leave_link_candidates(p_company_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE uid uuid := auth.uid();
BEGIN
  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard
  IF uid IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF NOT public.leave_access_ok() THEN RAISE EXCEPTION 'LEAVE_ACCESS_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF NOT public.user_is_organization_admin(p_company_id, uid) THEN RAISE EXCEPTION 'LEAVE_MANAGER_ONLY' USING ERRCODE = '42501'; END IF;
  RETURN (SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'user_id', m.user_id, 'role', m.role,
      'name', COALESCE(NULLIF(btrim(p.display_name), ''), NULLIF(btrim(p.full_name), ''), p.email),
      'email', p.email,
      'linked_employee_id', (SELECT e.id FROM public.rota_employees e WHERE e.organization_id = p_company_id AND e.user_id = m.user_id),
      'suggested_employee_id', (SELECT CASE WHEN count(*) = 1 THEN min(e.id::text)::uuid END FROM public.rota_employees e
                                 WHERE e.organization_id = p_company_id AND e.user_id IS NULL AND p.email IS NOT NULL
                                   AND lower(btrim(e.email)) = lower(btrim(p.email))))
      ORDER BY COALESCE(p.display_name, p.full_name, p.email)), '[]'::jsonb)
    FROM public.organization_members m LEFT JOIN public.profiles p ON p.id = m.user_id
   WHERE m.organization_id = p_company_id AND m.is_active);
END;
$function$;

-- Privileges: authenticated only (never anon). leave_access_ok is also called by the policies.
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.leave_access_ok()', 'public.leave_request_create(uuid,date,date,text,text,text,text)',
                           'public.leave_request_decide(uuid,text,text)', 'public.leave_request_cancel(uuid,text)', 'public.leave_balance(uuid,integer)',
                           'public.leave_calendar(uuid,date,date)', 'public.leave_settings_set(uuid,integer)', 'public.rota_employee_link(uuid,uuid)',
                           'public.leave_link_candidates(uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, service_role', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
END $$;

-- 8. Phase 25 guard log rows.
DO $$
DECLARE
  snip constant text := E'\n  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard';
  f text; src text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.leave_access_ok()', 'public.leave_request_create(uuid,date,date,text,text,text,text)',
                           'public.leave_request_decide(uuid,text,text)', 'public.leave_request_cancel(uuid,text)', 'public.leave_balance(uuid,integer)',
                           'public.leave_calendar(uuid,date,date)', 'public.leave_settings_set(uuid,integer)', 'public.rota_employee_link(uuid,uuid)',
                           'public.leave_link_candidates(uuid)'] LOOP
    SELECT prosrc INTO src FROM pg_proc WHERE oid = to_regprocedure(f);
    IF position(snip in src) = 0 THEN RAISE EXCEPTION '% has no guard line', f; END IF;
    INSERT INTO public.phase25_mfa_guard_log (fn, kind, old_md5, new_md5) VALUES (f, 'user', md5(replace(src, snip, '')), md5(src));
  END LOOP;
END $$;

-- 9. Final checks.
DO $$
DECLARE f record;
BEGIN
  FOR f IN SELECT p.oid::regprocedure::text AS fn FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND (p.proname ~ '^(leave_|_leave_)' OR p.proname = 'rota_employee_link') LOOP
    IF has_function_privilege('anon', f.fn, 'EXECUTE') THEN RAISE EXCEPTION 'anon can execute %', f.fn; END IF;
  END LOOP;
  IF has_table_privilege('anon', 'public.rota_leave_requests', 'SELECT') OR has_table_privilege('anon', 'public.rota_leave_allowances', 'SELECT')
     OR has_table_privilege('authenticated', 'public.rota_leave_requests', 'INSERT') OR has_table_privilege('authenticated', 'public.rota_leave_requests', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.rota_leave_requests', 'DELETE') THEN
    RAISE EXCEPTION 'leave tables are readable or writable beyond what is intended';
  END IF;
END $$;

COMMIT;
