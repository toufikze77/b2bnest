-- =====================================================================================================================
-- HMRC P8: read what HMRC holds (view a VAT return, liabilities, payments, penalties). Sandbox only, read only.
-- PREPARED, NOT APPLIED.
--
-- ORDER (docs/hmrc-p8/README.md): 1 the owner applies this; 2 deploys the four functions; 3 publishes the frontend.
--
-- What it changes (one transaction; any check failing changes nothing):
--   1. hmrc_audit_log.event also allows, for each of the four reads, '<kind>_call' (written before HMRC is called) and
--      '<kind>_result' (an outcome code, for example ok, not_found or matches), where <kind> is vat_return_view,
--      vat_liabilities, vat_payments or vat_penalties. Codes only (hal_reason is unchanged: ^[a-z0-9_]{1,60}$):
--      never a token, a VAT number, an amount or an HMRC response.
--   2. public.hmrc_take_read_slot(company, user, environment, kind, limit 10): service role only, SECURITY INVOKER,
--      SET search_path = ''. Under a per-company, per-kind advisory lock it counts that company's '<kind>_call' rows
--      in the last hour; below the limit it writes the row and returns true, otherwise false. An unknown kind: false.
--      Each read has its own bucket: obligations, test calls and submissions do not count, and do not get used up.
--   Nothing that HMRC returns is stored: P8 reads it live each time. No new table, no change to any existing
--   function, trigger, policy or grant, and no change to the immutability of hmrc_vat_submissions or hmrc_audit_log.
--
-- Production facts this was written against (read-only, 8 Nov 2026, HMRC P0-P7b applied): 148 tables in public
-- (md5 of the sorted names ca2f5c858ee858f9b3f7c14131e00b9f); hal_event = the fifteen P0-P6 events; md5(prosrc)
-- _hmrc_audit_append_only 6ae1ac1cea7541ebb73882222b74ecd0, _hmrc_vat_submission_guard 1e72b1b1e464e1676757fa8fefb7261a,
-- hmrc_manage_allowed 9304f069f05402aab62d343b3626cd65, hmrc_take_obligations_slot 58c7d543191e1960d2e6bd01ca643b0b.
-- (a body may also match with its whole-line comments removed: P7b's were applied without them). Anything else: refused.
-- Rollback: docs/hmrc-p8/rollback.sql. Tests: docs/hmrc-p8/run-test.sh.
-- =====================================================================================================================
BEGIN;

DO $$
DECLARE r record; v_def text;
BEGIN
  IF to_regprocedure('public.hmrc_take_read_slot(uuid,uuid,text,text,integer)') IS NOT NULL THEN
    RAISE EXCEPTION 'HMRC P8 already exists (applied twice?)';
  END IF;
  IF (SELECT md5(string_agg(relname, ',' ORDER BY relname)) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind IN ('r', 'p'))
     IS DISTINCT FROM 'ca2f5c858ee858f9b3f7c14131e00b9f' THEN
    RAISE EXCEPTION 'the tables in public differ from production as read on 8 Nov 2026 (apply HMRC P7b first)';
  END IF;
  FOR r IN SELECT * FROM (VALUES
      ('public._hmrc_audit_append_only()', '6ae1ac1cea7541ebb73882222b74ecd0'),
      ('public._hmrc_vat_submission_guard()', '1e72b1b1e464e1676757fa8fefb7261a'),
      ('public.hmrc_manage_allowed(uuid,uuid)', '9304f069f05402aab62d343b3626cd65'),
      ('public.hmrc_take_obligations_slot(uuid,uuid,text,text,integer)', '58c7d543191e1960d2e6bd01ca643b0b')) v(fn, h) LOOP
    -- P7b's two bodies were applied to production without their comment lines, so either form is accepted.
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = to_regprocedure(r.fn)
                    AND r.h IN (md5(prosrc), md5(regexp_replace(prosrc, E'\\n[ \\t]*--[^\\n]*', '', 'g')))) THEN
      RAISE EXCEPTION '% differs from the production body this was written against (or is missing)', r.fn;
    END IF;
  END LOOP;
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint WHERE conrelid = 'public.hmrc_audit_log'::regclass AND conname = 'hal_event';
  IF regexp_replace(COALESCE(v_def, ''), ' NOT VALID$', '') IS DISTINCT FROM
     'CHECK ((event = ANY (ARRAY[''connect_started''::text, ''connected''::text, ''refreshed''::text, ''refresh_failed''::text, ''disconnected''::text, ''refused''::text, ''test_call''::text, ''test_result''::text, ''obligations_call''::text, ''obligations_result''::text, ''vat_submit_start''::text, ''vat_submit_result''::text, ''vat_submit_unknown''::text, ''vat_submit_check''::text, ''fraud_validate''::text])))' THEN
    RAISE EXCEPTION 'hmrc_audit_log event rule differs from production';
  END IF;
  IF has_table_privilege('authenticated', 'public.hmrc_audit_log', 'SELECT') OR has_table_privilege('service_role', 'public.hmrc_audit_log', 'UPDATE')
     OR NOT has_table_privilege('service_role', 'public.hmrc_audit_log', 'INSERT') THEN
    RAISE EXCEPTION 'hmrc_audit_log privileges differ from production';
  END IF;
END $$;

-- 1. Eight more audit events (codes only).
ALTER TABLE public.hmrc_audit_log DROP CONSTRAINT hal_event;
ALTER TABLE public.hmrc_audit_log ADD CONSTRAINT hal_event CHECK (event IN ('connect_started', 'connected', 'refreshed', 'refresh_failed', 'disconnected', 'refused',
  'test_call', 'test_result', 'obligations_call', 'obligations_result',
  'vat_submit_start', 'vat_submit_result', 'vat_submit_unknown', 'vat_submit_check', 'fraud_validate',
  'vat_return_view_call', 'vat_return_view_result', 'vat_liabilities_call', 'vat_liabilities_result',
  'vat_payments_call', 'vat_payments_result', 'vat_penalties_call', 'vat_penalties_result'));

-- 2. The per-company limit for each read (10 an hour by default, its own bucket per kind).
CREATE FUNCTION public.hmrc_take_read_slot(p_company uuid, p_user uuid, p_environment text, p_kind text, p_limit integer DEFAULT 10)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF p_company IS NULL OR p_kind IS NULL OR p_kind NOT IN ('vat_return_view', 'vat_liabilities', 'vat_payments', 'vat_penalties') THEN
    RETURN false;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('hmrc_read:' || p_kind || ':' || p_company::text, 0));
  IF (SELECT count(*) FROM public.hmrc_audit_log a
       WHERE a.company_id = p_company AND a.event = p_kind || '_call' AND a.created_at > now() - interval '1 hour')
     >= least(greatest(COALESCE(p_limit, 10), 1), 60) THEN
    RETURN false;
  END IF;
  INSERT INTO public.hmrc_audit_log (company_id, user_id, environment, event, reason) VALUES (p_company, p_user, p_environment, p_kind || '_call', 'read');
  RETURN true;
END;
$function$;
REVOKE ALL ON FUNCTION public.hmrc_take_read_slot(uuid, uuid, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hmrc_take_read_slot(uuid, uuid, text, text, integer) TO service_role;

DO $$
BEGIN
  IF has_function_privilege('authenticated', 'public.hmrc_take_read_slot(uuid,uuid,text,text,integer)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.hmrc_take_read_slot(uuid,uuid,text,text,integer)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.hmrc_take_read_slot(uuid,uuid,text,text,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'privileges are not as intended';
  END IF;
END $$;

COMMIT;
