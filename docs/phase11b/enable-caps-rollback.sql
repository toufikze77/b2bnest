-- Phase 11b: switch seat caps OFF again (the live state on 2026-10-23). Nothing else changes.
BEGIN;
CREATE OR REPLACE FUNCTION public._seat_caps_enabled()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ SELECT false $function$;
COMMIT;
