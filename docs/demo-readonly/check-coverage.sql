-- Demo read-only: coverage check (READ-ONLY, safe to run any time in the SQL editor). Lists every table in public that
-- has neither the a0_demo_readonly_guard trigger nor a place on the allow-list (docs/demo-readonly/tables.json).
-- An empty result is the only good result. A new table must get the guard, or an allow-list entry with a reason.
-- (The same allow-list is in proposal.sql; src/test/demoReadonlyCoverage.test.ts keeps the copies identical.)
DO $$
DECLARE
-- BEGIN ALLOWED
  v_allowed text[] := ARRAY[
    'audit_logs', 'banking_audit_logs', 'demo_readonly_users', 'integration_audit_logs', 'notification_logs',
    'notification_type_prefs', 'notifications', 'payment_audit_logs', 'security_audit_logs', 'trial_email_log',
    'user_favorite_tools', 'user_favorites', 'user_notification_preferences'
  ];
-- END ALLOWED
  v_missing text;
BEGIN
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname) INTO v_missing FROM pg_class c
   WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p') AND NOT (c.relname = ANY (v_allowed))
     AND NOT EXISTS (SELECT 1 FROM pg_trigger tr WHERE tr.tgrelid = c.oid AND tr.tgname = 'a0_demo_readonly_guard'
                       AND tr.tgfoid = to_regprocedure('public.demo_readonly_guard()') AND tr.tgenabled = 'O');
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'DEMO_GUARD_MISSING: tables neither guarded nor allowed: %', v_missing;
  END IF;
  RAISE NOTICE 'DEMO_GUARD_OK: every table in public is guarded or allowed';
END $$;
