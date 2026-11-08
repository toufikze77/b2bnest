-- HMRC P8 tests (DISPOSABLE local Postgres only). Run by docs/hmrc-p8/run-test.sh after production's shape and
-- docs/hmrc-p8/proposal.sql. One transaction, rolled back. Fictional companies and people only.
\set ON_ERROR_STOP 1
BEGIN;
\i docs/phase37/test-helpers.sql
INSERT INTO auth.users (id, email) VALUES ('f8000000-0000-4000-8000-00000000000a', 'a@example.test');
CREATE FUNCTION pg_temp.slot(p_kind text, p_company uuid DEFAULT '0a800000-0000-4000-8000-000000000001', p_limit integer DEFAULT NULL) RETURNS boolean LANGUAGE sql AS $$
  SELECT CASE WHEN p_limit IS NULL THEN public.hmrc_take_read_slot(p_company, 'f8000000-0000-4000-8000-00000000000a', 'sandbox', p_kind)
              ELSE public.hmrc_take_read_slot(p_company, 'f8000000-0000-4000-8000-00000000000a', 'sandbox', p_kind, p_limit) END $$;
GRANT EXECUTE ON FUNCTION pg_temp.slot(text, uuid, integer) TO PUBLIC;

\echo '== the read slot (service role)'
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SET ROLE service_role;
DO $$ DECLARE i int; n int := 0; BEGIN
  FOR i IN 1..12 LOOP IF pg_temp.slot('vat_liabilities') THEN n := n + 1; END IF; END LOOP;
  PERFORM pg_temp.ok(n = 10, 'liabilities: 10 reads an hour per company, then refused');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.hmrc_audit_log WHERE event = 'vat_liabilities_call' AND reason = 'read') = 10, 'each read taken writes one vat_liabilities_call row (reason read)');
  PERFORM pg_temp.ok(pg_temp.slot('vat_payments') AND pg_temp.slot('vat_return_view') AND pg_temp.slot('vat_penalties'), 'each kind has its own bucket');
  PERFORM pg_temp.ok(pg_temp.slot('vat_liabilities', '0b800000-0000-4000-8000-000000000001'), 'each company has its own bucket');
  PERFORM pg_temp.ok(public.hmrc_take_obligations_slot('0a800000-0000-4000-8000-000000000001', 'f8000000-0000-4000-8000-00000000000a', 'sandbox', 'open'),
    'the obligations limit is not used up by the reads');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.hmrc_audit_log WHERE company_id = '0a800000-0000-4000-8000-000000000001' AND event = 'obligations_call') = 1,
    'and the reads are not counted as obligations');
  PERFORM pg_temp.ok(NOT pg_temp.slot('obligations') AND NOT pg_temp.slot('vat_submit') AND NOT pg_temp.slot('') AND NOT pg_temp.slot(NULL), 'an unknown kind is refused');
  PERFORM pg_temp.ok(NOT public.hmrc_take_read_slot(NULL::uuid, NULL::uuid, 'sandbox', 'vat_payments'), 'no company: refused');
  FOR i IN 1..3 LOOP PERFORM pg_temp.slot('vat_payments', '0c800000-0000-4000-8000-000000000001', 2); END LOOP;
  PERFORM pg_temp.ok((SELECT count(*) FROM public.hmrc_audit_log WHERE company_id = '0c800000-0000-4000-8000-000000000001') = 2, 'a smaller limit is honoured');
  n := 0;
  FOR i IN 1..70 LOOP IF pg_temp.slot('vat_penalties', '0d800000-0000-4000-8000-000000000001', 1000) THEN n := n + 1; END IF; END LOOP;
  PERFORM pg_temp.ok(n = 60, 'the limit is capped at 60 an hour');
END $$;
RESET ROLE;

\echo '== older rows do not count (inserted past the guard by the test only, as superuser)'
SET session_replication_role = replica;
INSERT INTO public.hmrc_audit_log (company_id, user_id, environment, event, reason, created_at)
  SELECT '0e800000-0000-4000-8000-000000000001', NULL, 'sandbox', 'vat_payments_call', 'read', now() - interval '61 minutes' FROM generate_series(1, 10);
SET session_replication_role = origin;
SET ROLE service_role;
DO $$ BEGIN
  PERFORM pg_temp.ok(pg_temp.slot('vat_payments', '0e800000-0000-4000-8000-000000000001'), 'reads older than an hour do not count');
END $$;

\echo '== the audit rule'
DO $$ BEGIN
  INSERT INTO public.hmrc_audit_log (company_id, user_id, environment, event, reason) VALUES
    ('0a800000-0000-4000-8000-000000000001', NULL, 'sandbox', 'vat_return_view_result', 'matches'),
    ('0a800000-0000-4000-8000-000000000001', NULL, 'sandbox', 'vat_liabilities_result', 'ok'),
    ('0a800000-0000-4000-8000-000000000001', NULL, 'sandbox', 'vat_payments_result', 'not_found'),
    ('0a800000-0000-4000-8000-000000000001', NULL, 'sandbox', 'vat_penalties_result', 'vrn_invalid');
  PERFORM pg_temp.ok(true, 'the four result events are allowed');
  PERFORM pg_temp.fails($q$INSERT INTO public.hmrc_audit_log (company_id, event) VALUES ('0a800000-0000-4000-8000-000000000001', 'vat_anything_call')$q$, 'hal_event', 'any other event is still refused');
  PERFORM pg_temp.fails($q$INSERT INTO public.hmrc_audit_log (company_id, event, reason) VALUES ('0a800000-0000-4000-8000-000000000001', 'vat_payments_result', '£100.00')$q$, 'hal_reason', 'the reason is still a code (no amounts)');
  PERFORM pg_temp.fails($q$UPDATE public.hmrc_audit_log SET reason = 'x' WHERE event = 'vat_payments_result'$q$, 'permission denied', 'the service role still cannot change audit rows');
END $$;
RESET ROLE;
DO $$ BEGIN
  PERFORM pg_temp.fails($q$UPDATE public.hmrc_audit_log SET reason = 'x' WHERE event = 'vat_payments_result'$q$, 'HMRC_AUDIT_APPEND_ONLY', 'the audit log stays append-only, even for the database owner');
  PERFORM pg_temp.fails($q$DELETE FROM public.hmrc_audit_log WHERE event = 'vat_payments_result'$q$, 'HMRC_AUDIT_APPEND_ONLY', 'and rows cannot be deleted');
END $$;

\echo '== who may call it'
SELECT set_config('request.jwt.claims', '{"sub":"f8000000-0000-4000-8000-00000000000a","role":"authenticated","aal":"aal2"}', true);
SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.fails($q$SELECT public.hmrc_take_read_slot('0a800000-0000-4000-8000-000000000001', 'f8000000-0000-4000-8000-00000000000a', 'sandbox', 'vat_payments')$q$,
    'permission denied', 'a signed-in person cannot take a slot (or write audit rows)');
  PERFORM pg_temp.fails($q$SELECT count(*) FROM public.hmrc_audit_log$q$, 'permission denied', 'and cannot read the audit log');
END $$;
RESET ROLE;
SET ROLE anon;
DO $$ BEGIN
  PERFORM pg_temp.fails($q$SELECT public.hmrc_take_read_slot('0a800000-0000-4000-8000-000000000001'::uuid, NULL::uuid, 'sandbox', 'vat_payments')$q$, 'permission denied', 'a visitor cannot take a slot');
END $$;
RESET ROLE;
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT prosecdef = false AND proconfig = ARRAY['search_path=""'] FROM pg_proc WHERE oid = 'public.hmrc_take_read_slot(uuid,uuid,text,text,integer)'::regprocedure),
    'SECURITY INVOKER with an empty search_path');
  PERFORM pg_temp.ok((SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind IN ('r', 'p')) = 148, 'no new table: 148 tables, as before');
END $$;
ROLLBACK;
