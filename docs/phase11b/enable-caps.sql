-- Phase 11b: switch seat caps ON — PREPARED, NOT APPLIED. Separate approval, after proposal.sql and data-step.sql,
-- and after precheck.sql shows no pool over its limit (or the owner accepts the listed pools staying over: nobody is
-- removed; they just can't add more until they are under). Undo: enable-caps-rollback.sql.
BEGIN;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='platform_plans' AND column_name='admin_limit')
     OR NOT EXISTS (SELECT 1 FROM public.platform_plans WHERE key='professional_legacy') THEN
    RAISE EXCEPTION 'apply proposal.sql first';
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public._seat_caps_enabled()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ SELECT true $function$;
COMMIT;
