-- =====================================================================================================================
-- HMRC P3: read VAT obligations (sandbox only, read only). PREPARED, NOT APPLIED.
--
-- ORDER (docs/hmrc-p3/README.md): 1 the owner applies this; 2 deploys hmrc-vat-obligations; 3 publishes the frontend.
--
-- What it changes (one transaction; any check failing changes nothing):
--   1. hmrc_audit_log.event also allows 'obligations_call' (written before HMRC is called; the reason is the request
--      kind, for example open or fulfilled) and 'obligations_result' (the outcome code, for example ok or not_found).
--      Codes only (hal_reason is unchanged: ^[a-z0-9_]{1,60}$): never a token, a VAT number or an HMRC response.
--   2. public.hmrc_take_obligations_slot(company, user, environment, kind, limit 10): service role only, SECURITY
--      INVOKER. Under a per-company advisory lock it counts that company's obligations_call rows in the last hour;
--      below the limit it writes the row and returns true, otherwise false. Its own bucket: test calls do not count.
--   Nothing is stored about obligations: P3 reads them live from HMRC each time. No new table, no change to any HMRC
--   function, policy or grant.
--
-- Production facts this was written against (read-only, 6 Nov 2026): hal_event = the eight HMRC P0 + P1/P2 events;
-- md5(prosrc) hmrc_manage_allowed 9304f069f05402aab62d343b3626cd65, hmrc_connection_status
-- 8d04b8c032d84f142acc0adf5bc59cb1, hmrc_take_test_slot be8ab280c2887bbd1a0937183d3f6167, _hmrc_audit_append_only
-- 8f283e3f58f0d54343cff1e44a86a49e. Anything else: refused.
-- Rollback: docs/hmrc-p3/rollback.sql. Tests: docs/hmrc-p3/run-test.sh.
-- =====================================================================================================================
BEGIN;

DO $$
DECLARE r record; v_def text;
BEGIN
  IF to_regprocedure('public.hmrc_take_obligations_slot(uuid,uuid,text,text,integer)') IS NOT NULL THEN
    RAISE EXCEPTION 'HMRC P3 already exists (applied twice?)';
  END IF;
  FOR r IN SELECT * FROM (VALUES
      ('public.hmrc_manage_allowed(uuid,uuid)', '9304f069f05402aab62d343b3626cd65'),
      ('public.hmrc_connection_status(uuid)', '8d04b8c032d84f142acc0adf5bc59cb1'),
      ('public.hmrc_take_test_slot(uuid,uuid,text,text,integer)', 'be8ab280c2887bbd1a0937183d3f6167'),
      ('public._hmrc_audit_append_only()', '8f283e3f58f0d54343cff1e44a86a49e')) v(fn, h) LOOP
    IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure(r.fn)) IS DISTINCT FROM r.h THEN
      RAISE EXCEPTION '% differs from the production body this was written against', r.fn;
    END IF;
  END LOOP;
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint WHERE conrelid = 'public.hmrc_audit_log'::regclass AND conname = 'hal_event';
  IF regexp_replace(COALESCE(v_def, ''), ' NOT VALID$', '') IS DISTINCT FROM
     'CHECK ((event = ANY (ARRAY[''connect_started''::text, ''connected''::text, ''refreshed''::text, ''refresh_failed''::text, ''disconnected''::text, ''refused''::text, ''test_call''::text, ''test_result''::text])))' THEN
    RAISE EXCEPTION 'hmrc_audit_log event rule differs from production';
  END IF;
  IF has_table_privilege('authenticated', 'public.hmrc_audit_log', 'SELECT') OR has_table_privilege('service_role', 'public.hmrc_audit_log', 'UPDATE')
     OR NOT has_table_privilege('service_role', 'public.hmrc_audit_log', 'INSERT') THEN
    RAISE EXCEPTION 'hmrc_audit_log privileges differ from production';
  END IF;
END $$;

-- 1. Two more audit events.
ALTER TABLE public.hmrc_audit_log DROP CONSTRAINT hal_event;
ALTER TABLE public.hmrc_audit_log ADD CONSTRAINT hal_event CHECK (event IN ('connect_started', 'connected', 'refreshed', 'refresh_failed', 'disconnected', 'refused',
                                                                          'test_call', 'test_result', 'obligations_call', 'obligations_result'));

-- 2. The per-company obligations limit (10 an hour, its own bucket).
CREATE FUNCTION public.hmrc_take_obligations_slot(p_company uuid, p_user uuid, p_environment text, p_kind text, p_limit integer DEFAULT 10)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF p_company IS NULL THEN RETURN false; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('hmrc_obligations:' || p_company::text, 0));
  IF (SELECT count(*) FROM public.hmrc_audit_log a
       WHERE a.company_id = p_company AND a.event = 'obligations_call' AND a.created_at > now() - interval '1 hour')
     >= least(greatest(COALESCE(p_limit, 10), 1), 60) THEN
    RETURN false;
  END IF;
  INSERT INTO public.hmrc_audit_log (company_id, user_id, environment, event, reason) VALUES (p_company, p_user, p_environment, 'obligations_call', p_kind);
  RETURN true;
END;
$function$;
REVOKE ALL ON FUNCTION public.hmrc_take_obligations_slot(uuid, uuid, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hmrc_take_obligations_slot(uuid, uuid, text, text, integer) TO service_role;

DO $$
BEGIN
  IF has_function_privilege('authenticated', 'public.hmrc_take_obligations_slot(uuid,uuid,text,text,integer)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.hmrc_take_obligations_slot(uuid,uuid,text,text,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'privileges are not as intended';
  END IF;
END $$;

COMMIT;
