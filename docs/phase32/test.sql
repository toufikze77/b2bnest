-- Phase 32 tests (DISPOSABLE local Postgres only). Run by docs/phase32/run-test.sh after the shim and fixtures.
\set ON_ERROR_STOP 1
\i docs/phase37/test-helpers.sql

-- People (b2…0NN): 1 owner of O1 (pays), 2 admin of O1 (employee EA), 3 staff S (ES), 4 staff T (ET), 5 owner of O2,
-- 6 staff of O2 (EO2), 7 staff of O3 whose owner (8) has a trial that ended, 9 suspended staff of O1 (ESUS),
-- 10 staff of O1 with two-step set up (EM), 11 member of O1 not yet linked, 12 member with an email two employees share.
INSERT INTO auth.users (id, email) SELECT ('b2000000-0000-4000-8000-0000000000' || lpad(x::text, 2, '0'))::uuid, 'user' || x || '@example.test' FROM generate_series(1, 12) x;
INSERT INTO public.profiles (id, email, full_name, trial_ends_at, is_active)
SELECT ('b2000000-0000-4000-8000-0000000000' || lpad(x::text, 2, '0'))::uuid, CASE WHEN x = 12 THEN 'dup@example.test' ELSE 'user' || x || '@example.test' END,
       'Person ' || x, CASE WHEN x = 8 THEN now() - interval '2 days' END, x <> 9
  FROM generate_series(1, 12) x;
INSERT INTO public.subscribers (user_id, email, subscribed, subscription_status, plan_key) VALUES
  ('b2000000-0000-4000-8000-000000000001', 'user1@example.test', true, 'active', 'professional'),
  ('b2000000-0000-4000-8000-000000000005', 'user5@example.test', true, 'active', 'starter');
INSERT INTO auth.mfa_factors (user_id, status) VALUES ('b2000000-0000-4000-8000-000000000010', 'verified');
INSERT INTO public.organizations (id, name, created_by) VALUES
  ('0c200000-0000-4000-8000-000000000001', 'O1 Ltd', 'b2000000-0000-4000-8000-000000000001'),
  ('0c200000-0000-4000-8000-000000000002', 'O2 Ltd', 'b2000000-0000-4000-8000-000000000005'),
  ('0c200000-0000-4000-8000-000000000003', 'O3 Ltd', 'b2000000-0000-4000-8000-000000000008');
INSERT INTO public.organization_members (organization_id, user_id, role) VALUES
  ('0c200000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'owner'),
  ('0c200000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000002', 'admin'),
  ('0c200000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000003', 'member'),
  ('0c200000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000004', 'member'),
  ('0c200000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000005', 'owner'),
  ('0c200000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000006', 'member'),
  ('0c200000-0000-4000-8000-000000000003', 'b2000000-0000-4000-8000-000000000008', 'owner'),
  ('0c200000-0000-4000-8000-000000000003', 'b2000000-0000-4000-8000-000000000007', 'member'),
  ('0c200000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000009', 'member'),
  ('0c200000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000010', 'member'),
  ('0c200000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000011', 'member'),
  ('0c200000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000012', 'member');
INSERT INTO public.organization_billing (organization_id, billing_user_id) VALUES
  ('0c200000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001'),
  ('0c200000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000005'),
  ('0c200000-0000-4000-8000-000000000003', 'b2000000-0000-4000-8000-000000000008');
INSERT INTO public.rota_employees (id, organization_id, user_id, full_name, email) VALUES
  ('e2000000-0000-4000-8000-0000000000a2', '0c200000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000002', 'Ann Admin', null),
  ('e2000000-0000-4000-8000-0000000000a3', '0c200000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000003', 'Sam Staff', null),
  ('e2000000-0000-4000-8000-0000000000a4', '0c200000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000004', 'Tia Team', null),
  ('e2000000-0000-4000-8000-0000000000a6', '0c200000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000006', 'Olu Other', null),
  ('e2000000-0000-4000-8000-0000000000a7', '0c200000-0000-4000-8000-000000000003', 'b2000000-0000-4000-8000-000000000007', 'Ted Ended', null),
  ('e2000000-0000-4000-8000-0000000000a9', '0c200000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000009', 'Sue Suspended', null),
  ('e2000000-0000-4000-8000-0000000000aa', '0c200000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000010', 'Mo Mfa', null),
  ('e2000000-0000-4000-8000-0000000000ab', '0c200000-0000-4000-8000-000000000001', null, 'Una Unlinked', 'USER11@example.test '),
  ('e2000000-0000-4000-8000-0000000000ac', '0c200000-0000-4000-8000-000000000001', null, 'Dup One', 'dup@example.test'),
  ('e2000000-0000-4000-8000-0000000000ad', '0c200000-0000-4000-8000-000000000001', null, 'Dup Two', 'dup@example.test');
CREATE TABLE public.t32_before AS SELECT (SELECT string_agg(id || '=' || coalesce(user_id::text, '-'), ',' ORDER BY id) FROM public.rota_employees) AS links,
  (SELECT string_agg(id || '=' || coalesce(settings::text, 'NULL'), ',' ORDER BY id) FROM public.organizations) AS settings;


\echo '== apply'
\i docs/phase32/proposal.sql
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.leave_access_ok()', 'public.leave_request_create(uuid,date,date,text,text,text,text)', 'public.leave_request_decide(uuid,text,text)',
                           'public.leave_request_cancel(uuid,text)', 'public.leave_balance(uuid,integer)', 'public.leave_calendar(uuid,date,date)',
                           'public.leave_settings_set(uuid,integer)', 'public.rota_employee_link(uuid,uuid)', 'public.leave_link_candidates(uuid)'] LOOP
    PERFORM pg_temp.ok((SELECT array_agg(x ORDER BY x) FROM unnest((SELECT proacl::text[] FROM pg_proc WHERE oid = f::regprocedure)) x)
      = ARRAY['authenticated=X/postgres','postgres=X/postgres'], f || ': authenticated only');
    PERFORM pg_temp.ok((SELECT prosecdef AND proconfig @> ARRAY['search_path=""'] FROM pg_proc WHERE oid = f::regprocedure), f || ': SECURITY DEFINER, search_path pinned');
  END LOOP;
  PERFORM pg_temp.ok((SELECT count(*) FROM public.phase25_mfa_guard_log g JOIN pg_proc p ON p.oid = to_regprocedure(g.fn)
                       WHERE (g.fn ~ 'leave_' OR g.fn ~ 'rota_employee_link') AND g.kind = 'user' AND md5(p.prosrc) = g.new_md5
                         AND md5(replace(p.prosrc, E'\n  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard', '')) = g.old_md5) = 9,
                     'guard log: 9 rows, new_md5 and old_md5 right');
  PERFORM pg_temp.ok((SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('rota_leave_requests', 'rota_leave_allowances')
                       AND policyname IN ('require_aal2_if_enrolled', 'leave_access') AND permissive = 'RESTRICTIVE') = 4, 'restrictive aal2 and access policies on both tables');
  PERFORM pg_temp.ok((SELECT bool_and(relrowsecurity) FROM pg_class WHERE oid IN ('public.rota_leave_requests'::regclass, 'public.rota_leave_allowances'::regclass)), 'RLS on both tables');
  PERFORM pg_temp.ok(NOT has_table_privilege('authenticated', 'public.rota_leave_requests', 'INSERT') AND NOT has_table_privilege('authenticated', 'public.rota_leave_requests', 'UPDATE')
                     AND NOT has_table_privilege('authenticated', 'public.rota_leave_requests', 'DELETE') AND has_table_privilege('authenticated', 'public.rota_leave_requests', 'SELECT'),
                     'requests: users read only (written by the functions, never deleted by users)');
  PERFORM pg_temp.ok(NOT has_table_privilege('anon', 'public.rota_leave_requests', 'SELECT') AND NOT has_table_privilege('anon', 'public.rota_leave_allowances', 'SELECT'), 'anon: no table access');
END $$;

CREATE FUNCTION pg_temp.who(n int, aal text DEFAULT 'aal1') RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', 'b2000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'), 'role', 'authenticated', 'aal', aal)::text, false) $$;
-- M = a Monday in March next year (always in the future when the suite runs).
CREATE FUNCTION pg_temp.m(plus int DEFAULT 0) RETURNS date LANGUAGE sql AS $$
  SELECT (date_trunc('week', make_date(extract(year FROM current_date)::int + 1, 3, 8))::date + plus) $$;
CREATE FUNCTION pg_temp.y() RETURNS int LANGUAGE sql AS $$ SELECT extract(year FROM current_date)::int + 1 $$;
GRANT EXECUTE ON FUNCTION pg_temp.who(int, text), pg_temp.m(int), pg_temp.y() TO PUBLIC;
CREATE TEMP TABLE ids (k text PRIMARY KEY, id uuid);
GRANT ALL ON ids TO PUBLIC;

\echo '== day counting (Monday to Friday, half days; bank holidays not subtracted)'
DO $$ BEGIN
  PERFORM pg_temp.ok(public._leave_working_days(pg_temp.m(0), pg_temp.m(4), 'full', 'full', '2000-01-01', '2100-01-01') = 5, 'Monday to Friday = 5 working days');
  PERFORM pg_temp.ok(public._leave_working_days(pg_temp.m(0), pg_temp.m(6), 'full', 'full', '2000-01-01', '2100-01-01') = 5, 'a weekend is not counted');
  PERFORM pg_temp.ok(public._leave_working_days(pg_temp.m(4), pg_temp.m(7), 'pm', 'am', '2000-01-01', '2100-01-01') = 1, 'Friday afternoon to Monday morning = 1 day');
  PERFORM pg_temp.ok(public._leave_working_days(pg_temp.m(2), pg_temp.m(2), 'am', 'am', '2000-01-01', '2100-01-01') = 0.5, 'one morning = 0.5');
  PERFORM pg_temp.ok(public._leave_working_days(pg_temp.m(5), pg_temp.m(5), 'full', 'full', '2000-01-01', '2100-01-01') = 0, 'a Saturday = 0');
  PERFORM pg_temp.ok(public._leave_working_days(pg_temp.m(0), pg_temp.m(4), 'full', 'full', pg_temp.m(2), pg_temp.m(3)) = 1, 'only the part inside the leave year counts');
END $$;

\echo '== staff ask'
SELECT pg_temp.who(3); SET ROLE authenticated;
DO $$
DECLARE j json;
BEGIN
  j := public.leave_request_create('e2000000-0000-4000-8000-0000000000a3', pg_temp.m(0), pg_temp.m(4), 'full', 'full', 'annual', '  Family trip  ');
  PERFORM pg_temp.ok(j ->> 'status' = 'pending' AND j ->> 'note' = 'Family trip' AND j ->> 'company_id' = '0c200000-0000-4000-8000-000000000001'
                     AND j ->> 'requester_user_id' = 'b2000000-0000-4000-8000-000000000003', 'staff request: pending, company from the employee, note trimmed');
  INSERT INTO ids VALUES ('week', (j ->> 'id')::uuid);
  j := public.leave_request_create('e2000000-0000-4000-8000-0000000000a3', pg_temp.m(7), pg_temp.m(7), 'am', 'am');
  INSERT INTO ids VALUES ('am', (j ->> 'id')::uuid);
  j := public.leave_request_create('e2000000-0000-4000-8000-0000000000a3', pg_temp.m(7), pg_temp.m(7), 'pm', 'pm');
  PERFORM pg_temp.ok(j ->> 'status' = 'pending', 'a morning and an afternoon of one day do not overlap');
  INSERT INTO ids VALUES ('pm', (j ->> 'id')::uuid);
  j := public.leave_request_create('e2000000-0000-4000-8000-0000000000a3', pg_temp.m(30), pg_temp.m(89), 'full', 'full', 'unpaid');
  PERFORM pg_temp.ok((j ->> 'end_date')::date - (j ->> 'start_date')::date = 59, '60 days is allowed');
  INSERT INTO ids VALUES ('unpaid', (j ->> 'id')::uuid);
END $$;
SELECT pg_temp.fails($$SELECT public.leave_request_create('e2000000-0000-4000-8000-0000000000a3', pg_temp.m(2), pg_temp.m(2))$$, 'LEAVE_OVERLAP', 'overlap with own pending request refused');
SELECT pg_temp.fails($$SELECT public.leave_request_create('e2000000-0000-4000-8000-0000000000a3', pg_temp.m(7), pg_temp.m(7))$$, 'LEAVE_OVERLAP', 'a full day over a booked half day refused');
SELECT pg_temp.fails($$SELECT public.leave_request_create('e2000000-0000-4000-8000-0000000000a3', pg_temp.m(100), pg_temp.m(160))$$, 'LEAVE_TOO_LONG', 'more than 60 days refused');
SELECT pg_temp.fails($$SELECT public.leave_request_create('e2000000-0000-4000-8000-0000000000a3', current_date - 1, current_date)$$, 'LEAVE_IN_PAST', 'staff cannot ask for a past date');
SELECT pg_temp.fails($$SELECT public.leave_request_create('e2000000-0000-4000-8000-0000000000a3', pg_temp.m(9), pg_temp.m(8))$$, 'LEAVE_DATES_INVALID', 'end before start refused');
SELECT pg_temp.fails($$SELECT public.leave_request_create('e2000000-0000-4000-8000-0000000000a3', pg_temp.m(14), pg_temp.m(15), 'am', 'full')$$, 'rlr_halves', 'several days starting in the morning half refused');
SELECT pg_temp.fails($$SELECT public.leave_request_create('e2000000-0000-4000-8000-0000000000a3', pg_temp.m(14), pg_temp.m(14), 'am', 'pm')$$, 'rlr_halves', 'one day with two different halves refused');
SELECT pg_temp.fails($$SELECT public.leave_request_create('e2000000-0000-4000-8000-0000000000a3', pg_temp.m(14), pg_temp.m(14), 'full', 'full', 'sabbatical')$$, 'kind_check', 'unknown kind refused');
SELECT pg_temp.fails($$SELECT public.leave_request_create('e2000000-0000-4000-8000-0000000000a3', pg_temp.m(14), pg_temp.m(14), 'full', 'full', 'annual', repeat('x', 501))$$, 'LEAVE_NOTE_TOO_LONG', 'note capped at 500');
SELECT pg_temp.fails($$SELECT public.leave_request_create('e2000000-0000-4000-8000-0000000000a4', pg_temp.m(14), pg_temp.m(14))$$, 'LEAVE_EMPLOYEE_NOT_FOUND', 'staff cannot ask for someone else');
SELECT pg_temp.fails($$SELECT public.leave_request_decide((SELECT id FROM ids WHERE k = 'week'), 'approve')$$, 'LEAVE_MANAGER_ONLY', 'staff cannot approve their own request');
SELECT pg_temp.fails($$INSERT INTO public.rota_leave_requests (company_id, employee_id, start_date, end_date) VALUES ('0c200000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-0000000000a3', current_date + 1, current_date + 1)$$,
                     'permission denied', 'no direct inserts');
SELECT pg_temp.fails($$DELETE FROM public.rota_leave_requests$$, 'permission denied', 'requests are never deleted by users');
RESET ROLE;

SELECT pg_temp.who(4); SET ROLE authenticated;
DO $$
DECLARE j json;
BEGIN
  j := public.leave_request_create('e2000000-0000-4000-8000-0000000000a4', pg_temp.m(1), pg_temp.m(2), 'full', 'full', 'annual', 'Private: hospital appointment');
  INSERT INTO ids VALUES ('tia', (j ->> 'id')::uuid);
  j := public.leave_request_create('e2000000-0000-4000-8000-0000000000a4', pg_temp.m(21), pg_temp.m(21));
  INSERT INTO ids VALUES ('tia2', (j ->> 'id')::uuid);
  j := public.leave_request_create('e2000000-0000-4000-8000-0000000000a4', pg_temp.m(28), pg_temp.m(28));
  INSERT INTO ids VALUES ('tia3', (j ->> 'id')::uuid);
END $$;
SELECT pg_temp.fails($$SELECT public.leave_request_decide((SELECT id FROM ids WHERE k = 'week'), 'approve')$$, 'LEAVE_MANAGER_ONLY', 'staff cannot approve someone else''s request');
RESET ROLE;

\echo '== managers decide'
SELECT pg_temp.who(2); SET ROLE authenticated;
DO $$
DECLARE j json;
BEGIN
  j := public.leave_request_decide((SELECT id FROM ids WHERE k = 'week'), 'approve');
  PERFORM pg_temp.ok(j ->> 'status' = 'approved' AND j ->> 'decided_by' = 'b2000000-0000-4000-8000-000000000002' AND (j ->> 'decided_at')::timestamptz = now(),
                     'admin approves: decided_by and decided_at = server time');
  j := public.leave_request_decide((SELECT id FROM ids WHERE k = 'tia'), 'approve');
  PERFORM pg_temp.ok(j ->> 'status' = 'approved', 'overlapping approved holiday of two people is allowed');
  j := public.leave_request_decide((SELECT id FROM ids WHERE k = 'tia2'), 'change', 'Please move this to the following week');
  PERFORM pg_temp.ok(j ->> 'status' = 'declined' AND (j ->> 'change_requested')::boolean AND j ->> 'decision_note' = 'Please move this to the following week', 'ask for a change: declined with change requested and the reason');
  j := public.leave_request_decide((SELECT id FROM ids WHERE k = 'tia3'), 'decline', 'Stocktake that day');
  PERFORM pg_temp.ok(j ->> 'status' = 'declined' AND NOT (j ->> 'change_requested')::boolean, 'decline with a reason');
  j := public.leave_request_create('e2000000-0000-4000-8000-0000000000a2', pg_temp.m(14), pg_temp.m(14));
  INSERT INTO ids VALUES ('ann', (j ->> 'id')::uuid);
END $$;
SELECT pg_temp.fails($$SELECT public.leave_request_decide((SELECT id FROM ids WHERE k = 'week'), 'decline')$$, 'LEAVE_ALREADY_DECIDED', 'a decided request cannot be decided again');
SELECT pg_temp.fails($$SELECT public.leave_request_decide((SELECT id FROM ids WHERE k = 'ann'), 'approve')$$, 'LEAVE_OWN_REQUEST', 'an admin cannot approve their own request');
SELECT pg_temp.fails($$SELECT public.leave_request_decide((SELECT id FROM ids WHERE k = 'am'), 'maybe')$$, 'LEAVE_DECISION_INVALID', 'unknown decision refused');
SELECT pg_temp.fails($$UPDATE public.rota_leave_requests SET status = 'approved'$$, 'permission denied', 'managers cannot edit requests directly');
RESET ROLE;
SELECT pg_temp.who(1); SET ROLE authenticated;
DO $$
DECLARE j json;
BEGIN
  j := public.leave_request_decide((SELECT id FROM ids WHERE k = 'ann'), 'approve');
  PERFORM pg_temp.ok(j ->> 'status' = 'approved', 'the owner approves the admin''s request');
  j := public.leave_request_create('e2000000-0000-4000-8000-0000000000a3', current_date - 3, current_date - 1, 'full', 'full', 'other', 'Recorded afterwards');
  PERFORM pg_temp.ok(j ->> 'status' = 'pending', 'a manager may record past dates');
  INSERT INTO ids VALUES ('past', (j ->> 'id')::uuid);
  PERFORM public.leave_request_decide((j ->> 'id')::uuid, 'approve');
END $$;
RESET ROLE;
SELECT pg_temp.who(5); SET ROLE authenticated;
SELECT pg_temp.fails($$SELECT public.leave_request_decide((SELECT id FROM ids WHERE k = 'am'), 'approve')$$, 'LEAVE_MANAGER_ONLY', 'another company''s owner cannot decide');
RESET ROLE;

\echo '== privacy'
SELECT pg_temp.who(3); SET ROLE authenticated;
DO $$
DECLARE j jsonb;
BEGIN
  PERFORM pg_temp.ok((SELECT count(*) FROM public.rota_leave_requests) = 5 AND NOT EXISTS (SELECT 1 FROM public.rota_leave_requests WHERE employee_id <> 'e2000000-0000-4000-8000-0000000000a3'),
                     'staff see only their own requests');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.rota_leave_requests WHERE note LIKE 'Private%' OR decision_note IN ('Stocktake that day')), 'staff never see another person''s note or reason');
  j := public.leave_calendar('0c200000-0000-4000-8000-000000000001', pg_temp.m(-7), pg_temp.m(30));
  PERFORM pg_temp.ok(jsonb_array_length(j) = 3, 'calendar: the three approved requests in range (Sam, Tia, Ann)');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM jsonb_array_elements(j) x WHERE x ->> 'full_name' = 'Tia Team' AND (x ->> 'start_date')::date = pg_temp.m(21)), 'calendar: declined requests not shown');
  PERFORM pg_temp.ok((SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(j -> 0) k) = ARRAY['employee_id','end_date','end_half','full_name','request_id','start_date','start_half'],
                     'calendar: name and dates only (no note, reason or allowance)');
END $$;
SELECT pg_temp.fails($$SELECT public.leave_balance('e2000000-0000-4000-8000-0000000000a4')$$, 'LEAVE_EMPLOYEE_NOT_FOUND', 'staff cannot see someone else''s balance');
SELECT pg_temp.fails($$SELECT public.leave_link_candidates('0c200000-0000-4000-8000-000000000001')$$, 'LEAVE_MANAGER_ONLY', 'staff cannot list members for linking');
SELECT pg_temp.fails($$SELECT public.rota_employee_link('e2000000-0000-4000-8000-0000000000ab', 'b2000000-0000-4000-8000-000000000003')$$, 'LEAVE_MANAGER_ONLY', 'staff cannot link employees');
SELECT pg_temp.fails($$SELECT public.leave_settings_set('0c200000-0000-4000-8000-000000000001', 4)$$, 'LEAVE_MANAGER_ONLY', 'staff cannot change the leave year');
SELECT pg_temp.fails($$INSERT INTO public.rota_leave_allowances (employee_id, leave_year, days) VALUES ('e2000000-0000-4000-8000-0000000000a3', 2030, 99)$$, 'row-level security', 'staff cannot set an allowance');
RESET ROLE;
SELECT pg_temp.who(6); SET ROLE authenticated;
SELECT pg_temp.fails($$SELECT public.leave_calendar('0c200000-0000-4000-8000-000000000001', current_date, current_date + 400)$$, 'ORGANIZATION_MEMBERSHIP_REQUIRED', 'another company cannot read the calendar');
DO $$ BEGIN PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.rota_leave_requests), 'another company sees no requests'); END $$;
RESET ROLE;
SELECT pg_temp.who(5); SET ROLE authenticated;
SELECT pg_temp.fails($$INSERT INTO public.rota_leave_allowances (company_id, employee_id, leave_year, days) VALUES ('0c200000-0000-4000-8000-000000000002', 'e2000000-0000-4000-8000-0000000000a3', 2030, 99)$$,
                     'LEAVE_EMPLOYEE_NOT_FOUND', 'another company''s owner cannot set an allowance (the employee isn''t theirs)');
DO $$ BEGIN PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.rota_leave_allowances), 'another company sees no allowances'); END $$;
RESET ROLE;

\echo '== allowances and balance'
SELECT pg_temp.who(1); SET ROLE authenticated;
INSERT INTO public.rota_leave_allowances (employee_id, leave_year, days) SELECT 'e2000000-0000-4000-8000-0000000000a3', pg_temp.y(), 25;
SELECT pg_temp.fails($$INSERT INTO public.rota_leave_allowances (employee_id, leave_year, days) VALUES ('e2000000-0000-4000-8000-0000000000a4', 2030, 366.5)$$, 'check', 'allowance capped at 366');
DO $$
DECLARE j jsonb;
BEGIN
  PERFORM pg_temp.ok((SELECT company_id FROM public.rota_leave_allowances LIMIT 1) = '0c200000-0000-4000-8000-000000000001', 'allowance company comes from the employee');
  j := public.leave_balance('e2000000-0000-4000-8000-0000000000a3', pg_temp.y());
  PERFORM pg_temp.ok((j ->> 'allowance_days')::numeric = 25 AND (j ->> 'used_days')::numeric = 5 AND (j ->> 'pending_days')::numeric = 1
                     AND (j ->> 'remaining_days')::numeric = 19 AND j ->> 'working_days' = 'mon_fri' AND (j ->> 'start_month')::int = 1,
                     'balance: 25 allowed, 5 used (approved), 1 pending (two halves), 19 left; unpaid not counted');
  j := public.leave_balance('e2000000-0000-4000-8000-0000000000a4', pg_temp.y());
  PERFORM pg_temp.ok(j ->> 'allowance_days' IS NULL AND j ->> 'remaining_days' IS NULL AND (j ->> 'used_days')::numeric = 2, 'no allowance set: no balance (used still counted)');
  j := public.leave_settings_set('0c200000-0000-4000-8000-000000000001', 4);
  PERFORM pg_temp.ok((j ->> 'leave_year_start_month')::int = 4, 'manager sets the leave year to start in April');
  j := public.leave_balance('e2000000-0000-4000-8000-0000000000a3', pg_temp.y() - 1);
  PERFORM pg_temp.ok((j ->> 'year_start')::date = make_date(pg_temp.y() - 1, 4, 1) AND (j ->> 'used_days')::numeric = 5 AND j ->> 'allowance_days' IS NULL,
                     'April leave year: March holiday counts in the year that started the April before');
END $$;
SELECT pg_temp.fails($$SELECT public.leave_settings_set('0c200000-0000-4000-8000-000000000001', 13)$$, 'LEAVE_MONTH_INVALID', 'month 13 refused');
RESET ROLE;
SELECT pg_temp.who(3); SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT count(*) FROM public.rota_leave_allowances) = 1, 'staff can read their own allowance');
  PERFORM pg_temp.ok((public.leave_balance('e2000000-0000-4000-8000-0000000000a3', pg_temp.y() - 1) ->> 'start_month')::int = 4, 'staff balance follows the company''s leave year');
END $$;
RESET ROLE;

\echo '== cancelling'
SELECT pg_temp.who(3); SET ROLE authenticated;
SELECT pg_temp.fails($$SELECT public.leave_request_cancel((SELECT id FROM ids WHERE k = 'past'))$$, 'LEAVE_ALREADY_STARTED', 'staff cannot cancel approved holiday that has started');
DO $$
DECLARE j json;
BEGIN
  j := public.leave_request_cancel((SELECT id FROM ids WHERE k = 'week'));
  PERFORM pg_temp.ok(j ->> 'status' = 'cancelled' AND j ->> 'cancelled_by' = 'b2000000-0000-4000-8000-000000000003', 'staff cancel approved holiday before it starts');
  j := public.leave_request_create('e2000000-0000-4000-8000-0000000000a3', pg_temp.m(0), pg_temp.m(4));
  PERFORM pg_temp.ok(j ->> 'status' = 'pending', 'after cancelling, the same days can be asked for again');
  j := public.leave_request_cancel((SELECT id FROM ids WHERE k = 'am'));
  PERFORM pg_temp.ok(j ->> 'status' = 'cancelled', 'staff cancel a pending request');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.rota_leave_requests WHERE status = 'cancelled') = 2, 'cancelled requests stay (never deleted)');
END $$;
SELECT pg_temp.fails($$SELECT public.leave_request_cancel((SELECT id FROM ids WHERE k = 'am'))$$, 'LEAVE_NOT_CANCELLABLE', 'a cancelled request cannot be cancelled again');
SELECT pg_temp.fails($$SELECT public.leave_request_cancel((SELECT id FROM ids WHERE k = 'tia'))$$, 'LEAVE_NOT_FOUND', 'staff cannot cancel someone else''s request');
RESET ROLE;
SELECT pg_temp.who(2); SET ROLE authenticated;
DO $$ BEGIN PERFORM pg_temp.ok((public.leave_request_cancel((SELECT id FROM ids WHERE k = 'past'), 'Back early') ->> 'status') = 'cancelled', 'a manager can cancel holiday that has started'); END $$;
RESET ROLE;

\echo '== linking members to employee rows'
SELECT pg_temp.who(1); SET ROLE authenticated;
DO $$
DECLARE j jsonb; x jsonb;
BEGIN
  j := public.leave_link_candidates('0c200000-0000-4000-8000-000000000001');
  SELECT e INTO x FROM jsonb_array_elements(j) e WHERE e ->> 'user_id' = 'b2000000-0000-4000-8000-000000000011';
  PERFORM pg_temp.ok(x ->> 'suggested_employee_id' = 'e2000000-0000-4000-8000-0000000000ab' AND x ->> 'linked_employee_id' IS NULL, 'suggestion when exactly one unlinked employee has the member''s email (case and spaces ignored)');
  SELECT e INTO x FROM jsonb_array_elements(j) e WHERE e ->> 'user_id' = 'b2000000-0000-4000-8000-000000000012';
  PERFORM pg_temp.ok(x ->> 'suggested_employee_id' IS NULL, 'no suggestion when two employees share the email');
  SELECT e INTO x FROM jsonb_array_elements(j) e WHERE e ->> 'user_id' = 'b2000000-0000-4000-8000-000000000003';
  PERFORM pg_temp.ok(x ->> 'linked_employee_id' = 'e2000000-0000-4000-8000-0000000000a3', 'shows existing links');
  PERFORM public.rota_employee_link('e2000000-0000-4000-8000-0000000000ab', 'b2000000-0000-4000-8000-000000000011');
  PERFORM pg_temp.ok((SELECT user_id FROM public.rota_employees WHERE id = 'e2000000-0000-4000-8000-0000000000ab') = 'b2000000-0000-4000-8000-000000000011', 'manager links a member');
END $$;
SELECT pg_temp.fails($$SELECT public.rota_employee_link('e2000000-0000-4000-8000-0000000000ac', 'b2000000-0000-4000-8000-000000000011')$$, 'LEAVE_MEMBER_ALREADY_LINKED', 'one employee row per member per company');
SELECT pg_temp.fails($$SELECT public.rota_employee_link('e2000000-0000-4000-8000-0000000000ac', 'b2000000-0000-4000-8000-000000000006')$$, 'ORGANIZATION_MEMBERSHIP_REQUIRED', 'only a member of this company can be linked');
RESET ROLE;

\echo '== access: trial ended, suspended, two-step, anon'
SELECT pg_temp.who(7); SET ROLE authenticated;
SELECT pg_temp.fails($$SELECT public.leave_request_create('e2000000-0000-4000-8000-0000000000a7', current_date + 10, current_date + 10)$$, 'LEAVE_ACCESS_REQUIRED', 'trial ended (company trial over): refused');
SELECT pg_temp.fails($$SELECT public.leave_calendar('0c200000-0000-4000-8000-000000000003', current_date, current_date + 30)$$, 'LEAVE_ACCESS_REQUIRED', 'trial ended: calendar refused');
RESET ROLE;
SELECT pg_temp.who(9); SET ROLE authenticated;
SELECT pg_temp.fails($$SELECT public.leave_request_create('e2000000-0000-4000-8000-0000000000a9', current_date + 10, current_date + 10)$$, 'LEAVE_ACCESS_REQUIRED', 'suspended: refused');
DO $$ BEGIN PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.rota_leave_requests), 'suspended: nothing readable'); END $$;
RESET ROLE;
SELECT pg_temp.who(10); SET ROLE authenticated;
SELECT pg_temp.fails($$SELECT public.leave_request_create('e2000000-0000-4000-8000-0000000000aa', current_date + 10, current_date + 10)$$, 'MFA_REQUIRED', 'two-step set up, code not entered: refused');
RESET ROLE;
SELECT pg_temp.who(10, 'aal2'); SET ROLE authenticated;
DO $$ BEGIN PERFORM pg_temp.ok((public.leave_request_create('e2000000-0000-4000-8000-0000000000aa', pg_temp.m(40), pg_temp.m(40)) ->> 'status') = 'pending', 'with the code (aal2): works'); END $$;
RESET ROLE; RESET request.jwt.claims;
SET ROLE anon;
SELECT pg_temp.fails($$SELECT public.leave_request_create('e2000000-0000-4000-8000-0000000000a3', current_date + 10, current_date + 10)$$, 'permission denied', 'anon: create refused');
SELECT pg_temp.fails($$SELECT public.leave_request_decide(gen_random_uuid(), 'approve')$$, 'permission denied', 'anon: decide refused');
SELECT pg_temp.fails($$SELECT public.leave_request_cancel(gen_random_uuid())$$, 'permission denied', 'anon: cancel refused');
SELECT pg_temp.fails($$SELECT public.leave_balance(gen_random_uuid())$$, 'permission denied', 'anon: balance refused');
SELECT pg_temp.fails($$SELECT public.leave_calendar(gen_random_uuid(), current_date, current_date)$$, 'permission denied', 'anon: calendar refused');
SELECT pg_temp.fails($$SELECT public.leave_settings_set(gen_random_uuid(), 1)$$, 'permission denied', 'anon: settings refused');
SELECT pg_temp.fails($$SELECT public.rota_employee_link(gen_random_uuid(), NULL)$$, 'permission denied', 'anon: link refused');
SELECT pg_temp.fails($$SELECT public.leave_link_candidates(gen_random_uuid())$$, 'permission denied', 'anon: candidates refused');
SELECT pg_temp.fails($$SELECT public.leave_access_ok()$$, 'permission denied', 'anon: access helper refused');
SELECT pg_temp.fails($$SELECT * FROM public.rota_leave_requests$$, 'permission denied', 'anon: requests table refused');
RESET ROLE;
