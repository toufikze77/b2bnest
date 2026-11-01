-- Phase 25 rollback: restores every guarded function body exactly (checked by hash), drops the restrictive policies,
-- the helper functions and the two tables. One transaction. Refuses if a guarded function was changed after the apply.
BEGIN;
DO $do$
DECLARE r record; oid_ regprocedure; src text; def text; newsrc text; snip text;
BEGIN
  IF to_regclass('public.phase25_mfa_guard_log') IS NULL THEN RAISE EXCEPTION 'Phase 25 is not applied'; END IF;
  FOR r IN SELECT * FROM public.phase25_mfa_guard_log ORDER BY fn LOOP
    oid_ := to_regprocedure(r.fn);
    IF oid_ IS NULL THEN RAISE EXCEPTION '% is missing', r.fn; END IF;
    SELECT p.prosrc INTO src FROM pg_proc p WHERE p.oid = oid_;
    IF md5(src) <> r.new_md5 THEN RAISE EXCEPTION '% was changed after Phase 25 was applied; restore it by hand', r.fn; END IF;
    snip := CASE WHEN position('
  PERFORM public.require_aal2_admin(); -- phase25 mfa guard' in src) > 0 THEN '
  PERFORM public.require_aal2_admin(); -- phase25 mfa guard'
                 WHEN position('
  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard' in src) > 0 THEN '
  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard'
                 WHEN position('
SELECT public.require_aal2_admin(); -- phase25 mfa guard
' in src) > 0 THEN '
SELECT public.require_aal2_admin(); -- phase25 mfa guard
'
                 ELSE '
SELECT public.require_aal2_if_enrolled(); -- phase25 mfa guard
' END;
    newsrc := replace(src, snip, '');
    def := pg_get_functiondef(oid_);
    EXECUTE replace(def, '$function$' || src || '$function$', '$function$' || newsrc || '$function$');
    IF (SELECT md5(p.prosrc) FROM pg_proc p WHERE p.oid = oid_) <> r.old_md5 THEN RAISE EXCEPTION '% did not return to its original body', r.fn; END IF;
  END LOOP;
END $do$;

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_policies WHERE schemaname = 'public' AND policyname = 'require_aal2_if_enrolled' LOOP
    EXECUTE format('DROP POLICY require_aal2_if_enrolled ON public.%I', t);
  END LOOP;
END $$;

DROP FUNCTION public.require_aal2_admin();
DROP FUNCTION public.require_aal2_if_enrolled();
DROP FUNCTION public.mfa_ok();
DROP TABLE public.phase25_mfa_guard_log;
DROP TABLE public.security_settings;
COMMIT;
