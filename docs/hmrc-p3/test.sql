-- HMRC P3 tests (DISPOSABLE local Postgres only). Run by docs/hmrc-p3/run-test.sh after production's shape (fixtures,
-- HMRC P0, plan rule, P1 + P2, demo read-only) and docs/hmrc-p3/proposal.sql. Fictional people and companies only.
\set ON_ERROR_STOP 1
\i docs/phase37/test-helpers.sql
INSERT INTO auth.users (id, email) VALUES ('f4000000-0000-4000-8000-000000000001', 'own@example.test'), ('f4000000-0000-4000-8000-000000000002', 'mem@example.test');
INSERT INTO public.profiles (id, email, full_name) VALUES ('f4000000-0000-4000-8000-000000000001', 'own@example.test', 'Owner'), ('f4000000-0000-4000-8000-000000000002', 'mem@example.test', 'Member');
INSERT INTO public.subscribers (user_id, email, subscribed, subscription_status, plan_key) VALUES ('f4000000-0000-4000-8000-000000000001', 'own@example.test', true, 'active', 'professional');
INSERT INTO public.organizations (id, name, created_by) VALUES ('0f400000-0000-4000-8000-000000000001', 'V Ltd', 'f4000000-0000-4000-8000-000000000001'),
                                                               ('0f400000-0000-4000-8000-000000000002', 'W Ltd', 'f4000000-0000-4000-8000-000000000001');
INSERT INTO public.organization_members (organization_id, user_id, role) VALUES ('0f400000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000001', 'owner'),
  ('0f400000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000002', 'member'), ('0f400000-0000-4000-8000-000000000002', 'f4000000-0000-4000-8000-000000000001', 'owner');
INSERT INTO public.organization_billing (organization_id, billing_user_id) VALUES ('0f400000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000001'),
                                                                                  ('0f400000-0000-4000-8000-000000000002', 'f4000000-0000-4000-8000-000000000001');

DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT string_agg(x, ',' ORDER BY x) FROM unnest((SELECT proacl::text[] FROM pg_proc WHERE oid = 'public.hmrc_take_obligations_slot(uuid,uuid,text,text,integer)'::regprocedure)) x)
                     = 'postgres=X/postgres,service_role=X/postgres'
                     AND NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.hmrc_take_obligations_slot(uuid,uuid,text,text,integer)'::regprocedure)
                     AND (SELECT proconfig @> ARRAY['search_path=""'] FROM pg_proc WHERE oid = 'public.hmrc_take_obligations_slot(uuid,uuid,text,text,integer)'::regprocedure),
                     'hmrc_take_obligations_slot: service role only, SECURITY INVOKER, search_path pinned');
  PERFORM pg_temp.ok((SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.hmrc_manage_allowed(uuid,uuid)'::regprocedure) = '9304f069f05402aab62d343b3626cd65'
                     AND (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.hmrc_connection_status(uuid)'::regprocedure) = '8d04b8c032d84f142acc0adf5bc59cb1'
                     AND (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.hmrc_take_test_slot(uuid,uuid,text,text,integer)'::regprocedure) = 'be8ab280c2887bbd1a0937183d3f6167',
                     'no existing HMRC function changed');
  PERFORM pg_temp.ok(to_regclass('public.hmrc_vat_obligations') IS NULL, 'nothing about obligations is stored (no cache table)');
END $$;

\echo '== rate limit: 10 an hour per company, its own bucket'
SET ROLE service_role;
DO $$ DECLARE i int; BEGIN
  FOR i IN 1..10 LOOP
    PERFORM pg_temp.ok(public.hmrc_take_obligations_slot('0f400000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000001', 'sandbox', 'open'), 'obligations call ' || i || ' of 10 allowed');
  END LOOP;
  PERFORM pg_temp.ok(NOT public.hmrc_take_obligations_slot('0f400000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000001', 'sandbox', 'fulfilled'), 'the 11th in an hour is refused');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.hmrc_audit_log WHERE company_id = '0f400000-0000-4000-8000-000000000001' AND event = 'obligations_call') = 10, 'a refused call writes no row');
  PERFORM pg_temp.ok(public.hmrc_take_test_slot('0f400000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000001', 'sandbox', 'hello_world'), 'test calls have their own bucket (still allowed)');
  PERFORM pg_temp.ok(public.hmrc_take_obligations_slot('0f400000-0000-4000-8000-000000000002', 'f4000000-0000-4000-8000-000000000001', 'sandbox', 'open'), 'another company has its own limit');
  PERFORM pg_temp.ok(NOT public.hmrc_take_obligations_slot('0f400000-0000-4000-8000-000000000002', 'f4000000-0000-4000-8000-000000000001', 'sandbox', 'open', 1), 'a smaller limit is honoured');
  PERFORM pg_temp.ok(NOT public.hmrc_take_obligations_slot(NULL, NULL, 'sandbox', 'open'), 'no company: refused');
  INSERT INTO public.hmrc_audit_log (company_id, user_id, environment, event, reason) VALUES ('0f400000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000001', 'sandbox', 'obligations_result', 'ok');
  PERFORM pg_temp.ok(NOT public.hmrc_take_obligations_slot('0f400000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000001', 'sandbox', 'open'), 'results do not count, but the limit still holds');
END $$;
SELECT pg_temp.fails($$SELECT public.hmrc_take_obligations_slot('0f400000-0000-4000-8000-000000000002', NULL, 'sandbox', '123456789 Bearer')$$, 'hal_reason', 'the kind is a short code only (no VAT number or token can be logged)');
SELECT pg_temp.fails($$INSERT INTO public.hmrc_audit_log (company_id, event) VALUES ('0f400000-0000-4000-8000-000000000001', 'obligations_submit')$$, 'hal_event', 'other event names are still refused');
SELECT pg_temp.fails($$UPDATE public.hmrc_audit_log SET reason = 'x'$$, 'permission denied', 'still append-only for the service role');
RESET ROLE;
SELECT pg_temp.fails($$DELETE FROM public.hmrc_audit_log$$, 'HMRC_AUDIT_APPEND_ONLY', 'still append-only for the database owner');

\echo '== who can see or call it'
SELECT set_config('request.jwt.claims', '{"sub":"f4000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', false);
SET ROLE authenticated;
SELECT pg_temp.fails($$SELECT public.hmrc_take_obligations_slot('0f400000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000001', 'sandbox', 'open')$$, 'permission denied', 'owner in the browser cannot call it (Edge Function only)');
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT count(*) FROM json_array_elements(public.hmrc_audit_events('0f400000-0000-4000-8000-000000000001')) e WHERE e ->> 'event' IN ('obligations_call', 'obligations_result')) = 11,
                     'the owner sees the company''s obligations calls and results in the audit trail');
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"f4000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', false);
SET ROLE authenticated;
SELECT pg_temp.fails($$SELECT public.hmrc_audit_events('0f400000-0000-4000-8000-000000000001')$$, 'HMRC_NOT_ALLOWED', 'a member does not see the audit trail');
RESET ROLE; RESET request.jwt.claims;
SET ROLE anon;
SELECT pg_temp.fails($$SELECT public.hmrc_take_obligations_slot('0f400000-0000-4000-8000-000000000001', NULL, 'sandbox', 'open')$$, 'permission denied', 'anon refused');
RESET ROLE;
