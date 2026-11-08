-- HMRC P6 tests (DISPOSABLE local Postgres only). Run by docs/hmrc-p6/run-test.sh after production's shape and
-- docs/hmrc-p6/proposal.sql. One transaction, rolled back. Fictional people and companies only.
-- People: A owns company X (Business); D is an admin of X; C is a plain member of X; B owns company Y; S owns company Z
-- (Solo / starter); M is the demo account (admin of X).
\set ON_ERROR_STOP 1
BEGIN;
\i docs/phase37/test-helpers.sql
INSERT INTO auth.users (id, email) VALUES
  ('f9000000-0000-4000-8000-00000000000a', 'a@example.test'), ('f9000000-0000-4000-8000-00000000000b', 'b@example.test'),
  ('f9000000-0000-4000-8000-00000000000c', 'c@example.test'), ('f9000000-0000-4000-8000-00000000000d', 'd@example.test'),
  ('f9000000-0000-4000-8000-0000000000e5', 's@example.test'), ('f9000000-0000-4000-8000-0000000000e6', 'm@example.test');
INSERT INTO public.organizations (id, name) VALUES ('0a900000-0000-4000-8000-000000000001', 'Company X'), ('0b900000-0000-4000-8000-000000000001', 'Company Y'),
  ('0c900000-0000-4000-8000-000000000001', 'Company Z');
INSERT INTO public.organization_members (organization_id, user_id, role, is_active) VALUES
  ('0a900000-0000-4000-8000-000000000001', 'f9000000-0000-4000-8000-00000000000a', 'owner', true),
  ('0a900000-0000-4000-8000-000000000001', 'f9000000-0000-4000-8000-00000000000d', 'admin', true),
  ('0a900000-0000-4000-8000-000000000001', 'f9000000-0000-4000-8000-00000000000c', 'member', true),
  ('0a900000-0000-4000-8000-000000000001', 'f9000000-0000-4000-8000-0000000000e6', 'admin', true),
  ('0b900000-0000-4000-8000-000000000001', 'f9000000-0000-4000-8000-00000000000b', 'owner', true),
  ('0c900000-0000-4000-8000-000000000001', 'f9000000-0000-4000-8000-0000000000e5', 'owner', true);
INSERT INTO public.demo_readonly_users (user_id) VALUES ('f9000000-0000-4000-8000-0000000000e6');

CREATE FUNCTION pg_temp.begin_x(p_key text, p_company uuid DEFAULT '0a900000-0000-4000-8000-000000000001') RETURNS text LANGUAGE sql AS $$
  SELECT result FROM public.hmrc_begin_vat_submission(p_company, 'f9000000-0000-4000-8000-00000000000a', 'sandbox', p_key, '2026-07-01', '2026-09-30',
    '{"vatDueSales": 205.00, "netVatDue": 145.00}'::jsonb, repeat('a', 64), gen_random_uuid(), '789', NULL, 'Ann Owner') $$;
CREATE FUNCTION pg_temp.as_user(u text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated', 'aal', 'aal1')::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.begin_x(text, uuid), pg_temp.as_user(text) TO PUBLIC;

\echo '== starting a submission (service role): one live submission per company and period'
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SET ROLE service_role;
DO $$ DECLARE r text; id1 uuid; BEGIN
  PERFORM pg_temp.ok(pg_temp.begin_x('18A1') = 'ok', 'the first attempt for a period starts (submitting)');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.hmrc_audit_log WHERE event = 'vat_submit_start' AND reason = 'submitting') = 1, 'the start is written to the audit log in the same transaction');
  PERFORM pg_temp.ok(pg_temp.begin_x('18A1') = 'already_live', 'a second attempt while one is submitting is refused (already_live)');
  SELECT id INTO id1 FROM public.hmrc_vat_submissions WHERE period_key = '18A1';
  UPDATE public.hmrc_vat_submissions SET status = 'rejected', http_status = 403, error_code = 'tax_period_not_ended', error_message = 'The period has not ended.' WHERE id = id1;
  PERFORM pg_temp.ok((SELECT completed_at IS NOT NULL FROM public.hmrc_vat_submissions WHERE id = id1), 'a rejected attempt is completed (completed_at set by the database)');
  PERFORM pg_temp.ok(pg_temp.begin_x('18A1') = 'ok', 'after a rejection, a new attempt may start');
  UPDATE public.hmrc_vat_submissions SET status = 'accepted', http_status = 201, processing_date = '2026-11-08T10:00:00Z', form_bundle_number = '123456789012', payment_indicator = 'BANK'
   WHERE period_key = '18A1' AND status = 'submitting';
  PERFORM pg_temp.ok(pg_temp.begin_x('18A1') = 'already_live', 'once accepted, the period can never be sent again');
  PERFORM pg_temp.ok(pg_temp.begin_x('18A2') = 'ok', 'another period of the same company is independent');
  UPDATE public.hmrc_vat_submissions SET status = 'unknown', error_code = 'hmrc_timeout' WHERE period_key = '18A2';
  PERFORM pg_temp.ok(pg_temp.begin_x('18A2') = 'already_live', 'while the outcome is unknown, no second attempt can start');
  UPDATE public.hmrc_vat_submissions SET status = 'accepted', error_code = 'received_per_obligation' WHERE period_key = '18A2';
  PERFORM pg_temp.ok((SELECT status FROM public.hmrc_vat_submissions WHERE period_key = '18A2') = 'accepted', 'an unknown outcome can be settled as accepted after a check');
  PERFORM pg_temp.ok(pg_temp.begin_x('18A1', '0b900000-0000-4000-8000-000000000001') = 'ok', 'company Y has its own record for the same period key');
END $$;

\echo '== immutable, for the service role too'
SELECT pg_temp.fails($$UPDATE public.hmrc_vat_submissions SET figures = '{"vatDueSales": 1}' WHERE period_key = '18A2'$$, 'HMRC_VAT_SUBMISSION_IMMUTABLE', 'the figures sent can never change');
SELECT pg_temp.fails($$UPDATE public.hmrc_vat_submissions SET figures_hash = repeat('b', 64) WHERE period_key = '18A2'$$, 'HMRC_VAT_SUBMISSION_IMMUTABLE', 'the figures hash can never change');
SELECT pg_temp.fails($$UPDATE public.hmrc_vat_submissions SET period_key = '18A3' WHERE period_key = '18A2'$$, 'HMRC_VAT_SUBMISSION_IMMUTABLE', 'the period can never change');
SELECT pg_temp.fails($$UPDATE public.hmrc_vat_submissions SET status = 'rejected' WHERE period_key = '18A2'$$, 'can''t become', 'an accepted submission can''t become rejected');
SELECT pg_temp.fails($$UPDATE public.hmrc_vat_submissions SET form_bundle_number = '999' WHERE form_bundle_number = '123456789012'$$, 'HMRC_VAT_SUBMISSION_IMMUTABLE', 'a recorded receipt can''t be changed');
SELECT pg_temp.fails($$DELETE FROM public.hmrc_vat_submissions$$, 'permission denied', 'the service role has no DELETE grant');
RESET ROLE;
SELECT pg_temp.fails($$DELETE FROM public.hmrc_vat_submissions$$, 'HMRC_VAT_SUBMISSION_IMMUTABLE', 'even the database owner can''t delete a submission (trigger)');
SELECT pg_temp.fails($$TRUNCATE public.hmrc_vat_submissions$$, 'HMRC_VAT_SUBMISSION_IMMUTABLE', 'TRUNCATE is refused');
SELECT pg_temp.fails($$INSERT INTO public.hmrc_vat_submissions (organization_id, period_key, period_start, period_end, figures, figures_hash, request_id, submitted_by, status)
  VALUES ('0a900000-0000-4000-8000-000000000001', '18A9', '2026-01-01', '2026-03-31', '{}', repeat('c', 64), gen_random_uuid(), 'f9000000-0000-4000-8000-00000000000a', 'accepted')$$,
  'starts as submitting', 'a row can''t be written as already accepted');
SELECT pg_temp.fails($$INSERT INTO public.hmrc_vat_submissions (organization_id, environment, period_key, period_start, period_end, figures, figures_hash, request_id, submitted_by)
  VALUES ('0a900000-0000-4000-8000-000000000001', 'production', '18A9', '2026-01-01', '2026-03-31', '{}', repeat('c', 64), gen_random_uuid(), 'f9000000-0000-4000-8000-00000000000a')$$,
  'hvs_environment', 'production can''t be recorded: sandbox only');

\echo '== rate limit: 5 attempts an hour per company'
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SET ROLE service_role;
DO $$ BEGIN
  -- Company X already has 3 attempts in this hour (18A1 twice, 18A2).
  PERFORM pg_temp.ok(pg_temp.begin_x('18B1') = 'ok', 'the 4th attempt this hour is allowed');
  PERFORM pg_temp.ok(pg_temp.begin_x('18B2') = 'ok', 'the 5th attempt this hour is allowed');
  PERFORM pg_temp.ok(pg_temp.begin_x('18B3') = 'limit', 'the 6th attempt this hour is refused (limit)');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.hmrc_vat_submissions WHERE period_key = '18B3'), 'a refused attempt writes no row');
END $$;
RESET ROLE;

\echo '== who can read (RLS)'
SET ROLE authenticated;
SELECT pg_temp.as_user('f9000000-0000-4000-8000-00000000000a');
DO $$ BEGIN PERFORM pg_temp.ok((SELECT count(*) FROM public.hmrc_vat_submissions) = 5, 'the owner of X reads X''s 5 attempts, and none of Y''s'); END $$;
SELECT pg_temp.as_user('f9000000-0000-4000-8000-00000000000d');
DO $$ BEGIN PERFORM pg_temp.ok((SELECT count(*) FROM public.hmrc_vat_submissions) = 5, 'an admin of X reads them'); END $$;
SELECT pg_temp.as_user('f9000000-0000-4000-8000-00000000000c');
DO $$ BEGIN PERFORM pg_temp.ok((SELECT count(*) FROM public.hmrc_vat_submissions) = 0, 'a plain member reads nothing'); END $$;
SELECT pg_temp.as_user('f9000000-0000-4000-8000-0000000000e5');
DO $$ BEGIN PERFORM pg_temp.ok((SELECT count(*) FROM public.hmrc_vat_submissions) = 0, 'a Solo account (another company) reads nothing'); END $$;
SELECT pg_temp.as_user('f9000000-0000-4000-8000-00000000000b');
DO $$ BEGIN PERFORM pg_temp.ok((SELECT count(*) FROM public.hmrc_vat_submissions) = 1 AND (SELECT organization_id FROM public.hmrc_vat_submissions) = '0b900000-0000-4000-8000-000000000001',
  'company Y''s owner reads only Y''s row (cross-company isolation)'); END $$;
SELECT pg_temp.fails($$INSERT INTO public.hmrc_vat_submissions (organization_id, period_key, period_start, period_end, figures, figures_hash, request_id, submitted_by)
  VALUES ('0b900000-0000-4000-8000-000000000001', '18C1', '2026-01-01', '2026-03-31', '{}', repeat('c', 64), gen_random_uuid(), 'f9000000-0000-4000-8000-00000000000b')$$, 'permission denied', 'the browser can''t insert');
SELECT pg_temp.fails($$UPDATE public.hmrc_vat_submissions SET status = 'rejected'$$, 'permission denied', 'the browser can''t update');
SELECT pg_temp.fails($$DELETE FROM public.hmrc_vat_submissions$$, 'permission denied', 'the browser can''t delete');
SELECT pg_temp.fails($$SELECT * FROM public.hmrc_begin_vat_submission('0b900000-0000-4000-8000-000000000001', 'f9000000-0000-4000-8000-00000000000b', 'sandbox', '18C1', '2026-01-01', '2026-03-31', '{}', repeat('d', 64), gen_random_uuid(), '789', NULL, 'B')$$,
  'permission denied', 'the browser can''t start a submission');
SELECT pg_temp.as_user('f9000000-0000-4000-8000-0000000000e6');
SELECT pg_temp.fails($$INSERT INTO public.hmrc_vat_submissions (organization_id, period_key, period_start, period_end, figures, figures_hash, request_id, submitted_by)
  VALUES ('0a900000-0000-4000-8000-000000000001', '18C2', '2026-01-01', '2026-03-31', '{}', repeat('c', 64), gen_random_uuid(), 'f9000000-0000-4000-8000-0000000000e6')$$, 'permission denied', 'the demo account can''t write a submission');
RESET ROLE;
INSERT INTO auth.mfa_factors (user_id, status) VALUES ('f9000000-0000-4000-8000-00000000000d', 'verified');
SET ROLE authenticated;
SELECT pg_temp.as_user('f9000000-0000-4000-8000-00000000000d');
DO $$ BEGIN PERFORM pg_temp.ok((SELECT count(*) FROM public.hmrc_vat_submissions) = 0, 'an admin with an authenticator who hasn''t entered the code reads nothing (aal2)'); END $$;
RESET ROLE;
SET ROLE anon;
SELECT pg_temp.fails($$SELECT * FROM public.hmrc_vat_submissions$$, 'permission denied', 'anon can''t read');
RESET ROLE;

\echo '== audit log'
DO $$ DECLARE e text; BEGIN
  FOREACH e IN ARRAY ARRAY['vat_submit_start', 'vat_submit_result', 'vat_submit_unknown', 'vat_submit_check', 'fraud_validate'] LOOP
    INSERT INTO public.hmrc_audit_log (company_id, user_id, environment, event, reason) VALUES ('0a900000-0000-4000-8000-000000000001', 'f9000000-0000-4000-8000-00000000000a', 'sandbox', e, 'ok');
  END LOOP;
  PERFORM pg_temp.ok(true, 'hal_event accepts the five new events');
END $$;
SELECT pg_temp.fails($$INSERT INTO public.hmrc_audit_log (company_id, environment, event, reason) VALUES ('0a900000-0000-4000-8000-000000000001', 'sandbox', 'vat_submit_anything', 'ok')$$, 'hal_event', 'other events are still refused');
SELECT pg_temp.fails($$UPDATE public.hmrc_audit_log SET reason = 'changed' WHERE event = 'vat_submit_start'$$, 'HMRC_AUDIT_APPEND_ONLY', 'the audit log stays append-only');
ROLLBACK;
