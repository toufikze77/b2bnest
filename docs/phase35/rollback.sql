-- =====================================================================================================================
-- Phase 35 rollback (one transaction). Restores check_and_deduct_ai_credit(uuid,integer), refund_ai_credit(uuid,integer)
-- and get_ai_credits_info(uuid) byte for byte from public.phase35_function_backup (checked by hash), with their exact
-- privileges and Phase 25 guard log rows, then removes everything Phase 35 added.
--
-- !!! This DROPS public.ai_credit_ledger (the history) and public.ai_model_prices. Export the ledger first if you want to
-- !!! keep it:  COPY (SELECT * FROM public.ai_credit_ledger) TO STDOUT WITH CSV HEADER;   (or the dashboard's export)
-- !!! Roll the Edge Functions back to the previous deployment FIRST: the Phase 35 functions call
-- !!! record_ai_usage and pass p_feature / p_request_id, which no longer exist after this.
-- =====================================================================================================================
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.phase35_function_backup') IS NULL OR to_regclass('public.phase35_guard_log_backup') IS NULL THEN
    RAISE EXCEPTION 'Phase 35 is not applied';
  END IF;
  IF (SELECT count(*) FROM public.phase35_function_backup) <> 3 OR (SELECT count(*) FROM public.phase35_guard_log_backup) <> 2 THEN
    RAISE EXCEPTION 'Phase 35 backup is incomplete';
  END IF;
END $$;

DROP FUNCTION public.admin_ai_ledger_summary(integer);
DROP FUNCTION public.record_ai_usage(uuid, uuid, text, text, text, integer, integer);
DROP FUNCTION public.check_and_deduct_ai_credit(uuid, integer, text, uuid);
DROP FUNCTION public.refund_ai_credit(uuid, integer, text, uuid);

-- Recreate from the saved definitions (pg_get_functiondef output: CREATE OR REPLACE FUNCTION ...).
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM public.phase35_function_backup ORDER BY fn LOOP
    EXECUTE r.def;
    IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.' || r.fn)) IS DISTINCT FROM r.src_md5 THEN
      RAISE EXCEPTION '% did not return to its saved body', r.fn;
    END IF;
  END LOOP;
END $$;

-- The saved privileges (the backup's acl column; read on 2 Nov 2026 as below).
REVOKE ALL ON FUNCTION public.check_and_deduct_ai_credit(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_and_deduct_ai_credit(uuid, integer) TO service_role, authenticated;
REVOKE ALL ON FUNCTION public.refund_ai_credit(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_ai_credit(uuid, integer) TO service_role;
-- get_ai_credits_info kept its privileges (CREATE OR REPLACE never changes them).
DO $$
DECLARE r record; now_acl text[];
BEGIN
  FOR r IN SELECT * FROM public.phase35_function_backup LOOP
    SELECT proacl::text[] INTO now_acl FROM pg_proc WHERE oid = to_regprocedure('public.' || r.fn);
    IF (SELECT array_agg(x ORDER BY x) FROM unnest(now_acl) x) IS DISTINCT FROM (SELECT array_agg(x ORDER BY x) FROM unnest(r.acl::text[]) x) THEN
      RAISE EXCEPTION '% privileges % differ from the saved %', r.fn, now_acl, r.acl;
    END IF;
  END LOOP;
END $$;

-- Phase 25 guard log back to its earlier rows.
DELETE FROM public.phase25_mfa_guard_log
 WHERE fn IN ('public.check_and_deduct_ai_credit(uuid,integer,text,uuid)', 'public.get_ai_credits_info(uuid)', 'public.admin_ai_ledger_summary(integer)');
INSERT INTO public.phase25_mfa_guard_log SELECT * FROM public.phase35_guard_log_backup;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.phase35_guard_log_backup b
              WHERE (SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure(b.fn)) IS DISTINCT FROM b.new_md5) THEN
    RAISE EXCEPTION 'the Phase 25 guard log does not match the restored bodies';
  END IF;
END $$;

DROP TABLE public.ai_credit_ledger;
DROP FUNCTION public.ai_credit_ledger_append_only();
DROP TABLE public.ai_model_prices;
DROP TABLE public.phase35_guard_log_backup;
DROP TABLE public.phase35_function_backup;
COMMIT;
