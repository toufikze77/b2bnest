-- =====================================================================================================================
-- Phase 32 rollback (one transaction). Removes the holiday tables and functions, the one-employee-per-user index and
-- the guard log rows, and puts back exactly what the functions changed outside them: each company's settings and each
-- employee's user_id as they were before the first change (from public.phase32_backup).
--
-- !!! DATA: this DROPS every holiday request and allowance. It REFUSES while any request, allowance, settings change or
-- !!! employee link made through Phase 32 exists, unless you export them first and run it with
-- !!!   SET LOCAL app.phase32_force = 'on';   (after BEGIN). Publish the previous frontend first.
-- =====================================================================================================================
BEGIN;
DO $$
BEGIN
  IF to_regclass('public.phase32_backup') IS NULL THEN RAISE EXCEPTION 'Phase 32 is not applied'; END IF;
  IF (EXISTS (SELECT 1 FROM public.rota_leave_requests) OR EXISTS (SELECT 1 FROM public.rota_leave_allowances) OR EXISTS (SELECT 1 FROM public.phase32_backup))
     AND COALESCE(current_setting('app.phase32_force', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Companies have holiday data (% requests, % allowances, % settings or links changed). Export it first; then SET LOCAL app.phase32_force = ''on'' (this deletes it).',
      (SELECT count(*) FROM public.rota_leave_requests), (SELECT count(*) FROM public.rota_leave_allowances), (SELECT count(*) FROM public.phase32_backup);
  END IF;
END $$;

DROP FUNCTION public.leave_link_candidates(uuid);
DROP FUNCTION public.rota_employee_link(uuid, uuid);
DROP FUNCTION public.leave_settings_set(uuid, integer);
DROP FUNCTION public.leave_calendar(uuid, date, date);
DROP FUNCTION public.leave_balance(uuid, integer);
DROP FUNCTION public.leave_request_cancel(uuid, text);
DROP FUNCTION public.leave_request_decide(uuid, text, text);
DROP FUNCTION public.leave_request_create(uuid, date, date, text, text, text, text);
DROP TABLE public.rota_leave_allowances;
DROP TABLE public.rota_leave_requests;
DROP FUNCTION public.leave_access_ok();
DROP FUNCTION public._leave_allowance_guard();
DROP FUNCTION public._leave_request_guard();
DROP FUNCTION public._leave_working_days(date, date, text, text, date, date);
DROP FUNCTION public._leave_slot_from(date, text);
DROP FUNCTION public._leave_slot_to(date, text);

-- Settings and links exactly as before the first change.
UPDATE public.organizations o SET settings = b.value -> 'v' FROM public.phase32_backup b WHERE b.kind = 'settings' AND b.key = o.id;
UPDATE public.organizations o SET settings = NULL FROM public.phase32_backup b WHERE b.kind = 'settings' AND b.key = o.id AND jsonb_typeof(b.value -> 'v') = 'null';
DROP INDEX public.rota_employees_org_user_uniq;
UPDATE public.rota_employees e SET user_id = NULLIF(b.value ->> 'v', '')::uuid FROM public.phase32_backup b WHERE b.kind = 'link' AND b.key = e.id;

DELETE FROM public.phase25_mfa_guard_log
 WHERE fn IN ('public.leave_access_ok()', 'public.leave_request_create(uuid,date,date,text,text,text,text)', 'public.leave_request_decide(uuid,text,text)',
              'public.leave_request_cancel(uuid,text)', 'public.leave_balance(uuid,integer)', 'public.leave_calendar(uuid,date,date)',
              'public.leave_settings_set(uuid,integer)', 'public.rota_employee_link(uuid,uuid)', 'public.leave_link_candidates(uuid)');
DROP TABLE public.phase32_backup;
COMMIT;
