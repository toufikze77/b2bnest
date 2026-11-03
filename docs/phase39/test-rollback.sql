-- Phase 39 rollback tests. run-test.sh runs this after test.sql and after checking that rollback.sql refuses while rows
-- exist without app.phase39_force.
\set ON_ERROR_STOP 1
\i docs/phase37/test-helpers.sql
SET app.phase39_force = 'on';
\i docs/phase39/rollback.sql
RESET app.phase39_force;
DO $$ BEGIN
  PERFORM pg_temp.ok(t39.fingerprint() = (SELECT fp FROM t39.before), 'forced rollback: tables, functions, policies, grants and guard log exactly as before Phase 39');
  PERFORM pg_temp.ok(to_regclass('public.free_tool_items') IS NULL AND to_regclass('public.marketing_consents') IS NULL
                     AND to_regprocedure('public.free_tools_write_ok()') IS NULL AND to_regprocedure('public.marketing_consent_set(boolean,text)') IS NULL
                     AND to_regprocedure('public.marketing_consent_record_signup()') IS NULL AND to_regprocedure('public._free_tool_item_guard()') IS NULL,
                     'forced rollback: Phase 39 tables and functions removed');
  PERFORM pg_temp.ok((SELECT count(*) FROM auth.users) = 9, 'forced rollback: no account touched');
END $$;

\echo '== apply again'
\i docs/phase39/proposal.sql
DO $$ BEGIN
  PERFORM pg_temp.ok(to_regclass('public.free_tool_items') IS NOT NULL AND to_regclass('public.marketing_consents') IS NOT NULL
                     AND (SELECT count(*) FROM public.phase25_mfa_guard_log WHERE fn ~ 'free_tools_write_ok|marketing_consent') = 3, 're-apply after rollback works');
END $$;
