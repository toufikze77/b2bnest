-- Phase 32 rollback tests. run-test.sh runs this after test.sql and after checking rollback.sql refuses without force.
\set ON_ERROR_STOP 1
\i docs/phase37/test-helpers.sql
SET app.phase32_force = 'on';
\i docs/phase32/rollback.sql
RESET app.phase32_force;
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT string_agg(id || '=' || coalesce(user_id::text, '-'), ',' ORDER BY id) FROM public.rota_employees) = (SELECT links FROM public.t32_before),
                     'rollback: every employee''s user link exactly as before');
  PERFORM pg_temp.ok((SELECT string_agg(id || '=' || coalesce(settings::text, 'NULL'), ',' ORDER BY id) FROM public.organizations) = (SELECT settings FROM public.t32_before),
                     'rollback: every company''s settings exactly as before');
  PERFORM pg_temp.ok((SELECT string_agg(indexname, ',' ORDER BY indexname) FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'rota_employees') = 'rota_employees_org_idx,rota_employees_pkey',
                     'rollback: rota_employees indexes exactly as before');
  PERFORM pg_temp.ok((SELECT string_agg(policyname, '|' ORDER BY policyname) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'rota_employees')
                     = 'require_aal2_if_enrolled|rota_employees_delete_admins|rota_employees_insert_admins|rota_employees_select_org_members|rota_employees_update_admins', 'rollback: rota_employees policies untouched');
  PERFORM pg_temp.ok(to_regclass('public.rota_leave_requests') IS NULL AND to_regclass('public.rota_leave_allowances') IS NULL AND to_regclass('public.phase32_backup') IS NULL
                     AND NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND (p.proname ~ '^(leave_|_leave_)' OR p.proname = 'rota_employee_link')),
                     'rollback: tables and functions removed');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.phase25_mfa_guard_log WHERE fn ~ 'leave_|rota_employee_link'), 'rollback: guard log rows removed');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.rota_employees) = 10 AND (SELECT count(*) FROM public.phase25_mfa_guard_log) > 0, 'rollback: employees and other guard rows untouched');
END $$;
\echo '== apply again'
\i docs/phase32/proposal.sql
DO $$ BEGIN
  PERFORM pg_temp.ok(to_regclass('public.rota_leave_requests') IS NOT NULL AND (SELECT count(*) FROM public.phase25_mfa_guard_log WHERE fn ~ 'leave_|rota_employee_link') = 9,
                     're-apply after rollback works');
END $$;
DROP TABLE public.t32_before;
