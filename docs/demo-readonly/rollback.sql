-- =====================================================================================================================
-- Demo read-only: ROLLBACK. Removes the guard triggers, both functions, the guard log row and the table, exactly.
-- Refuses unless the demo read-only objects are the ones proposal.sql created. If anyone is still listed in
-- demo_readonly_users it refuses, unless forced:   SET app.demo_readonly_force = 'on';   (then run this file)
-- After a rollback nobody is view only any more: un-publish the demo login first.
-- =====================================================================================================================
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.demo_readonly_users') IS NULL OR to_regprocedure('public.is_demo_readonly()') IS NULL
     OR to_regprocedure('public.demo_readonly_guard()') IS NULL THEN
    RAISE EXCEPTION 'Demo read-only is not applied; nothing to roll back';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgname = 'a0_demo_readonly_guard'
              AND t.tgfoid <> 'public.demo_readonly_guard()'::regprocedure) THEN
    RAISE EXCEPTION 'A trigger named a0_demo_readonly_guard calls another function; check it by hand';
  END IF;
  IF EXISTS (SELECT 1 FROM public.demo_readonly_users) AND coalesce(current_setting('app.demo_readonly_force', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Someone is still listed in demo_readonly_users (a demo login may be in use). Remove the rows, or SET app.demo_readonly_force = ''on'' to roll back anyway.';
  END IF;
END $$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT t.tgrelid::regclass AS tbl FROM pg_trigger t
            WHERE t.tgname = 'a0_demo_readonly_guard' AND t.tgfoid = 'public.demo_readonly_guard()'::regprocedure LOOP
    EXECUTE format('DROP TRIGGER a0_demo_readonly_guard ON %s', r.tbl);
  END LOOP;
END $$;

DROP FUNCTION public.demo_readonly_guard();
DROP FUNCTION public.is_demo_readonly();
DELETE FROM public.phase25_mfa_guard_log WHERE fn = 'public.is_demo_readonly()';
DROP TABLE public.demo_readonly_users;

COMMIT;
