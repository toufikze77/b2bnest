-- HMRC P7b tests (DISPOSABLE local Postgres only). Run by docs/hmrc-p7b/run-test.sh after production's shape,
-- docs/hmrc-p7b/fixture.sql and docs/hmrc-p7b/proposal.sql. One transaction, rolled back. Fictional people only.
-- Company X: A owner (the only owner), D admin, C member, M admin (the demo account), Q member who pays for X.
-- Company Y: B owner, alone. Company W: E owner, alone, connected to HMRC's sandbox with one submission.
-- P: an active paid subscription, no company. N: a person who doesn't exist.
\set ON_ERROR_STOP 1
BEGIN;
\i docs/phase37/test-helpers.sql
INSERT INTO auth.users (id, email) VALUES
  ('f7000000-0000-4000-8000-00000000000a', 'a@example.test'), ('f7000000-0000-4000-8000-00000000000b', 'b@example.test'),
  ('f7000000-0000-4000-8000-00000000000c', 'c@example.test'), ('f7000000-0000-4000-8000-00000000000d', 'd@example.test'),
  ('f7000000-0000-4000-8000-00000000000e', 'e@example.test'), ('f7000000-0000-4000-8000-0000000000e6', 'm@example.test'),
  ('f7000000-0000-4000-8000-0000000000f1', 'p@example.test'), ('f7000000-0000-4000-8000-0000000000f2', 'q@example.test');
INSERT INTO public.profiles (id, email, full_name) SELECT id, email, upper(left(email, 1)) || ' Person' FROM auth.users WHERE id::text LIKE 'f7000000%';
INSERT INTO public.organizations (id, name, slug, created_by) VALUES
  ('0a700000-0000-4000-8000-000000000001', 'Company X', 'company-x', 'f7000000-0000-4000-8000-00000000000a'),
  ('0b700000-0000-4000-8000-000000000001', 'Company Y', 'company-y', 'f7000000-0000-4000-8000-00000000000b'),
  ('0e700000-0000-4000-8000-000000000001', 'Company W', 'company-w', 'f7000000-0000-4000-8000-00000000000e');
INSERT INTO public.organization_members (organization_id, user_id, role, is_active, invited_by) VALUES
  ('0a700000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-00000000000a', 'owner', true, NULL),
  ('0a700000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-00000000000d', 'admin', true, 'f7000000-0000-4000-8000-00000000000c'),
  ('0a700000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-00000000000c', 'member', true, 'f7000000-0000-4000-8000-00000000000a'),
  ('0a700000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-0000000000e6', 'admin', true, NULL),
  ('0a700000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-0000000000f2', 'member', true, NULL),
  ('0b700000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-00000000000b', 'owner', true, NULL),
  ('0e700000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-00000000000e', 'owner', true, NULL);
INSERT INTO public.demo_readonly_users (user_id) VALUES ('f7000000-0000-4000-8000-0000000000e6');
INSERT INTO public.organization_billing (organization_id, billing_user_id) VALUES ('0a700000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-0000000000f2');
INSERT INTO public.subscribers (user_id, email, subscribed, stripe_subscription_id, subscription_status, cancel_at_period_end)
  VALUES ('f7000000-0000-4000-8000-0000000000f1', 'p@example.test', true, 'sub_test_1', 'active', false);
-- Business records: C made one invoice for X and one personal; B has an invoice and an expense in Y; E has notes.
INSERT INTO public.invoices (user_id, organization_id, invoice_number) VALUES
  ('f7000000-0000-4000-8000-00000000000c', '0a700000-0000-4000-8000-000000000001', 'X-C-1'),
  ('f7000000-0000-4000-8000-00000000000c', NULL, 'C-PERSONAL-1'),
  ('f7000000-0000-4000-8000-00000000000b', '0b700000-0000-4000-8000-000000000001', 'Y-B-1'),
  ('f7000000-0000-4000-8000-00000000000a', '0a700000-0000-4000-8000-000000000001', 'X-A-1');
INSERT INTO public.expenses (user_id, organization_id, category, description, amount, date) VALUES
  ('f7000000-0000-4000-8000-00000000000b', '0b700000-0000-4000-8000-000000000001', 'Office', 'Paper', 10, '2026-10-01');
-- C also has a task in X (owned by A, assigned to C), a finished time entry on an X project, and HMRC settings for X
-- while A has them too (one row per person and company).
INSERT INTO public.projects (id, user_id, name, organization_id) VALUES ('0a7000aa-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-00000000000a', 'X project', '0a700000-0000-4000-8000-000000000001');
INSERT INTO public.todos (id, user_id, organization_id, assigned_to, status, note) VALUES
  ('0a7000bb-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-00000000000a', '0a700000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-00000000000c', 'open', 'X task for C');
INSERT INTO public.project_time_entries (project_id, user_id, task_name, start_time, end_time, duration_minutes, is_billable, created_at, updated_at)
  VALUES ('0a7000aa-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-00000000000c', 'C work', now() - interval '3 hours', now() - interval '2 hours', 60, true, now(), now());
INSERT INTO public.hmrc_settings (user_id, organization_id, vat_number) VALUES
  ('f7000000-0000-4000-8000-00000000000a', '0a700000-0000-4000-8000-000000000001', 'GB111111111'),
  ('f7000000-0000-4000-8000-00000000000c', '0a700000-0000-4000-8000-000000000001', 'GB111111111');
INSERT INTO public.notes (user_id, note) VALUES ('f7000000-0000-4000-8000-00000000000e', 'E private note'), ('f7000000-0000-4000-8000-00000000000a', 'A note');
INSERT INTO public.ai_credit_ledger (user_id, note) VALUES ('f7000000-0000-4000-8000-00000000000e', 'spend');
INSERT INTO public.hmrc_connections (company_id, environment, status, access_token_enc, refresh_token_enc, connected_by)
  VALUES ('0e700000-0000-4000-8000-000000000001', 'sandbox', 'connected', 'v1.kid.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBB',
          'v1.kid.CCCCCCCCCCCCCCCC.DDDDDDDDDDDDDDDDDDDDDD', 'f7000000-0000-4000-8000-00000000000e'),
         ('0b700000-0000-4000-8000-000000000001', 'sandbox', 'connected', 'v1.kid.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBB',
          'v1.kid.CCCCCCCCCCCCCCCC.DDDDDDDDDDDDDDDDDDDDDD', 'f7000000-0000-4000-8000-00000000000b');
SELECT public.hmrc_begin_vat_submission('0e700000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-00000000000e', 'sandbox', '18A1',
  '2026-07-01', '2026-09-30', '{"netVatDue": 145.00}', repeat('a', 64), gen_random_uuid(), '789', NULL, 'Erin Owner');
SELECT public.hmrc_begin_vat_submission('0b700000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-00000000000b', 'sandbox', '18A1',
  '2026-07-01', '2026-09-30', '{"netVatDue": 10.00}', repeat('b', 64), gen_random_uuid(), '111', NULL, 'Bea Owner');
-- An old sandbox submission and an old audit row for the purge (inserted past the guards by the test only, as superuser).
ALTER TABLE public.hmrc_vat_submissions DISABLE TRIGGER USER;
ALTER TABLE public.hmrc_audit_log DISABLE TRIGGER USER;
INSERT INTO public.hmrc_vat_submissions (organization_id, environment, period_key, period_start, period_end, status, figures, figures_hash, request_id, submitted_by, submitted_by_name, submitted_at)
  VALUES ('0a700000-0000-4000-8000-000000000001', 'sandbox', '17A1', '2024-01-01', '2024-03-31', 'accepted', '{}', repeat('c', 64), gen_random_uuid(),
          'f7000000-0000-4000-8000-00000000000a', 'Ann Owner', '2024-04-02');
INSERT INTO public.hmrc_audit_log (company_id, user_id, environment, event, reason, created_at)
  VALUES ('0a700000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-00000000000a', 'sandbox', 'connected', NULL, now() - interval '7 years');
ALTER TABLE public.hmrc_vat_submissions ENABLE TRIGGER USER;
ALTER TABLE public.hmrc_audit_log ENABLE TRIGGER USER;

CREATE FUNCTION pg_temp.as_user(u text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated', 'aal', 'aal1')::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.as_user(text) TO PUBLIC;

\echo '== the clean-up and the new objects'
DO $$ BEGIN
  PERFORM pg_temp.ok(to_regclass('public.hmrc_integrations') IS NULL, 'hmrc_integrations (plain-text token columns, 0 rows) is gone');
  PERFORM pg_temp.ok((SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind IN ('r', 'p')) = 148,
    'the other 146 tables are still there, plus data_rights_requests and _data_rights_gate (148)');
  PERFORM pg_temp.ok(to_regclass('public.hmrc_connections') IS NOT NULL AND to_regclass('public.hmrc_settings') IS NOT NULL AND to_regclass('public.hmrc_vat_submissions') IS NOT NULL,
    'the HMRC tables that are in use are untouched');
  PERFORM pg_temp.ok((SELECT confdeltype FROM pg_constraint WHERE conname = 'hmrc_vat_submissions_organization_id_fkey') = 'r',
    'hmrc_vat_submissions -> organizations is still ON DELETE RESTRICT');
  PERFORM pg_temp.ok((SELECT count(*) FROM pg_trigger WHERE tgrelid = 'public.hmrc_vat_submissions'::regclass AND tgname IN ('hmrc_vat_submissions_guard', 'hmrc_vat_submissions_no_truncate')) = 2
    AND (SELECT count(*) FROM pg_trigger WHERE tgrelid = 'public.hmrc_audit_log'::regclass AND tgname LIKE 'hmrc_audit_log_%') = 3,
    'every immutability trigger is still in place');
END $$;

\echo '== immutability still holds for everyone (service role included) outside the gated paths'
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SET ROLE service_role;
DO $$ BEGIN
  PERFORM pg_temp.fails($q$DELETE FROM public.hmrc_vat_submissions WHERE organization_id = '0e700000-0000-4000-8000-000000000001'$q$, 'permission denied', 'service role can''t delete a submission (no grant)');
  PERFORM pg_temp.fails($q$UPDATE public.hmrc_vat_submissions SET submitted_by_name = 'Deleted user' WHERE organization_id = '0e700000-0000-4000-8000-000000000001'$q$,
    'HMRC_VAT_SUBMISSION_IMMUTABLE', 'the "Deleted user" change is refused without the gate');
  PERFORM pg_temp.fails($q$UPDATE public.hmrc_vat_submissions SET period_key = '18A9' WHERE organization_id = '0e700000-0000-4000-8000-000000000001'$q$,
    'HMRC_VAT_SUBMISSION_IMMUTABLE', 'what was sent still can''t change');
  PERFORM pg_temp.fails($q$DELETE FROM public.hmrc_audit_log$q$, 'permission denied', 'service role can''t delete audit rows (no grant)');
  PERFORM pg_temp.fails($q$INSERT INTO public._data_rights_gate VALUES (txid_current(), 'hmrc_purge')$q$, 'permission denied', 'service role can''t open the gate by writing to it');
  PERFORM pg_temp.fails($q$SELECT public._data_rights_gate_set('hmrc_purge', true)$q$, 'permission denied', 'service role can''t call the gate opener');
  PERFORM pg_temp.fails($q$SELECT public._data_rights_close_org('0a700000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-00000000000a')$q$, 'permission denied',
    'service role can''t call the internal closer');
  PERFORM pg_temp.ok(NOT public._data_rights_gate_is_open('hmrc_purge') AND NOT public._data_rights_gate_is_open('anonymise'), 'the gate is shut in an ordinary transaction');
END $$;
RESET ROLE;
DO $$ BEGIN
  -- A setting anyone can make (as the old ai_credit_ledger purge switch works) does not open this gate.
  PERFORM set_config('b2bnest.hmrc_purge', 'on', true); PERFORM set_config('app.hmrc_purge', 'on', true);
  PERFORM pg_temp.fails($q$DELETE FROM public.hmrc_vat_submissions WHERE period_key = '17A1'$q$, 'HMRC_VAT_SUBMISSION_IMMUTABLE', 'even the table owner is stopped by the guard, settings or not');
  PERFORM pg_temp.fails($q$DELETE FROM public.hmrc_audit_log$q$, 'HMRC_AUDIT_APPEND_ONLY', 'even the table owner can''t delete audit rows');
  PERFORM pg_temp.fails($q$TRUNCATE public.hmrc_vat_submissions$q$, 'HMRC_VAT_SUBMISSION_IMMUTABLE', 'TRUNCATE is still refused (submissions)');
  PERFORM pg_temp.fails($q$TRUNCATE public.hmrc_audit_log$q$, 'HMRC_AUDIT_APPEND_ONLY', 'TRUNCATE is still refused (audit log)');
END $$;

\echo '== who may call what'
DO $$ BEGIN
  PERFORM pg_temp.ok(NOT has_function_privilege('authenticated', 'public.hmrc_purge_expired_audit(boolean)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.hmrc_purge_expired_audit(boolean)', 'EXECUTE'), 'the purge: no signed-in person or visitor');
  PERFORM pg_temp.ok(NOT has_function_privilege('authenticated', 'public.data_rights_delete_account(uuid,uuid,boolean)', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'public.data_rights_close_company(uuid,uuid,uuid,boolean)', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'public.data_rights_take_slot(uuid,uuid,text,integer)', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'public.data_rights_company_role(uuid,uuid)', 'EXECUTE'), 'deletion, closure, slots and roles: Edge Functions only');
  PERFORM pg_temp.ok(has_function_privilege('service_role', 'public.hmrc_purge_expired_audit(boolean)', 'EXECUTE'), 'the purge: service role');
END $$;
SELECT pg_temp.as_user('f7000000-0000-4000-8000-00000000000a');
SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.fails($q$SELECT * FROM public.hmrc_purge_expired_audit(true)$q$, 'permission denied', 'a signed-in person can''t run the purge, even as a dry run');
  PERFORM pg_temp.fails($q$SELECT public.data_rights_delete_account('f7000000-0000-4000-8000-00000000000b', NULL, false)$q$, 'permission denied', 'a signed-in person can''t delete anyone');
  PERFORM pg_temp.fails($q$SELECT public.data_rights_close_company('0b700000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-00000000000b', NULL, false)$q$, 'permission denied',
    'a signed-in person can''t close a company directly');
  PERFORM pg_temp.fails($q$UPDATE public.organizations SET closed_at = now() WHERE id = '0a700000-0000-4000-8000-000000000001'$q$, 'COMPANY_CLOSED',
    'an owner can''t mark their company closed through the table (only the reviewed closure can)');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.organizations WHERE id = '0a700000-0000-4000-8000-000000000001') = 1, 'an open company is still visible to its members');
END $$;
RESET ROLE;

\echo '== rate limit and demo'
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SET ROLE service_role;
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT result FROM public.data_rights_take_slot('f7000000-0000-4000-8000-00000000000a', NULL, 'export_account', 2)) = 'ok', 'first export slot');
  PERFORM pg_temp.ok((SELECT result FROM public.data_rights_take_slot('f7000000-0000-4000-8000-00000000000a', NULL, 'export_account', 2)) = 'ok', 'second export slot');
  PERFORM pg_temp.ok((SELECT result FROM public.data_rights_take_slot('f7000000-0000-4000-8000-00000000000a', NULL, 'export_account', 2)) = 'limit', 'third within the hour: limit');
  PERFORM pg_temp.ok((SELECT result FROM public.data_rights_take_slot('f7000000-0000-4000-8000-00000000000a', '0a700000-0000-4000-8000-000000000001', 'export_company', 2)) = 'ok',
    'a different kind has its own limit');
  PERFORM pg_temp.ok((SELECT result FROM public.data_rights_take_slot('f7000000-0000-4000-8000-0000000000e6', NULL, 'export_account', 2)) = 'demo', 'the demo account is refused');
  PERFORM pg_temp.ok((SELECT result FROM public.data_rights_take_slot('f7000000-0000-4000-8000-00000000000a', NULL, 'export_company', 2)) = 'bad_request', 'a company export needs a company');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.data_rights_requests WHERE user_id = 'f7000000-0000-4000-8000-00000000000a') = 3, 'each accepted request is recorded (audit row)');
  PERFORM pg_temp.ok(public.data_rights_finish((SELECT id FROM public.data_rights_requests WHERE kind = 'export_company' LIMIT 1), 'done', 'export_ready'), 'a request is finished once');
  PERFORM pg_temp.ok(NOT public.data_rights_finish((SELECT id FROM public.data_rights_requests WHERE kind = 'export_company' LIMIT 1), 'failed', 'again'), 'and can''t be changed after');
END $$;
RESET ROLE;
SELECT pg_temp.as_user('f7000000-0000-4000-8000-00000000000b');
SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT count(*) FROM public.data_rights_requests) = 0, 'B can''t see A''s requests');
  PERFORM pg_temp.fails($q$INSERT INTO public.data_rights_requests (user_id, kind) VALUES ('f7000000-0000-4000-8000-00000000000b', 'export_account')$q$, 'permission denied',
    'nobody writes request rows from the browser');
END $$;
RESET ROLE;

\echo '== tenants: roles are per company'
SET ROLE service_role;
DO $$ BEGIN
  PERFORM pg_temp.ok(public.data_rights_company_role('0a700000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-00000000000a') = 'owner', 'A owns X');
  PERFORM pg_temp.ok(public.data_rights_company_role('0a700000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-00000000000d') = 'admin', 'D is an admin of X');
  PERFORM pg_temp.ok(public.data_rights_company_role('0a700000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-00000000000c') = 'member', 'C is a member of X (no company export)');
  PERFORM pg_temp.ok(public.data_rights_company_role('0b700000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-00000000000a') = 'not_member', 'A is nothing in Y: no export of Y');
  PERFORM pg_temp.ok(public.data_rights_company_role(gen_random_uuid(), 'f7000000-0000-4000-8000-00000000000a') = 'not_member', 'an unknown company: not_member');
END $$;

\echo '== company closure'
DO $$ DECLARE j jsonb; BEGIN
  j := public.data_rights_close_company('0b700000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-00000000000a', NULL, true);
  PERFORM pg_temp.ok(j->>'result' = 'not_owner', 'A can''t close B''s company Y');
  j := public.data_rights_close_company('0a700000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-00000000000d', NULL, false);
  PERFORM pg_temp.ok(j->>'result' = 'not_owner', 'an admin can''t close the company (owners only)');
  j := public.data_rights_close_company('0a700000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-0000000000e6', NULL, false);
  PERFORM pg_temp.ok(j->>'result' = 'demo', 'the demo account is refused');
  j := public.data_rights_close_company('0b700000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-00000000000b', NULL, true);
  PERFORM pg_temp.ok(j->>'result' = 'ok' AND (j->>'members')::int = 1 AND (j->>'hmrc_submissions')::int = 1 AND (j->>'hmrc_connected')::boolean,
    'check only: B sees what closing Y means (1 member, HMRC connected, 1 submission)');
  PERFORM pg_temp.ok((SELECT closed_at IS NULL FROM public.organizations WHERE id = '0b700000-0000-4000-8000-000000000001'), 'the check changed nothing');
  j := public.data_rights_close_company('0b700000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-00000000000b', NULL, false);
  PERFORM pg_temp.ok(j->>'result' = 'closed', 'B closes Y');
  PERFORM pg_temp.ok((SELECT name = 'Closed company' AND closed_at IS NOT NULL AND slug LIKE 'closed-%' AND created_by IS NULL AND NOT is_active
    FROM public.organizations WHERE id = '0b700000-0000-4000-8000-000000000001'), 'Y is a shell named "Closed company"');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = '0b700000-0000-4000-8000-000000000001'), 'no members left');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.invoices WHERE organization_id = '0b700000-0000-4000-8000-000000000001')
    AND NOT EXISTS (SELECT 1 FROM public.expenses WHERE organization_id = '0b700000-0000-4000-8000-000000000001'), 'its invoices and expenses are gone');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.hmrc_connections WHERE company_id = '0b700000-0000-4000-8000-000000000001'), 'the HMRC connection and its tokens are gone');
  PERFORM pg_temp.ok(EXISTS (SELECT 1 FROM public.hmrc_audit_log WHERE company_id = '0b700000-0000-4000-8000-000000000001' AND event = 'disconnected' AND reason = 'company_closed'),
    'the HMRC trail records the disconnection');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.hmrc_vat_submissions WHERE organization_id = '0b700000-0000-4000-8000-000000000001') = 1, 'its HMRC submission stays (6 years)');
  j := public.data_rights_close_company('0b700000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-00000000000b', NULL, false);
  PERFORM pg_temp.ok(j->>'result' = 'already_closed', 'closing twice: already_closed');
  PERFORM pg_temp.ok(public.data_rights_company_role('0b700000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-00000000000b') = 'closed', 'role check says closed (no export of it)');
END $$;
RESET ROLE;
DO $$ BEGIN
  PERFORM pg_temp.fails($q$INSERT INTO public.organization_members (organization_id, user_id, role, is_active) VALUES ('0b700000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-00000000000b', 'owner', true)$q$,
    'COMPANY_CLOSED', 'nobody can join a closed company (no sign-in context)');
  PERFORM pg_temp.fails($q$INSERT INTO public.hmrc_connections (company_id, environment, status) VALUES ('0b700000-0000-4000-8000-000000000001', 'sandbox', 'disconnected')$q$,
    'COMPANY_CLOSED', 'no HMRC connection for a closed company');
  PERFORM pg_temp.fails($q$SELECT public.hmrc_begin_vat_submission('0b700000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-00000000000b', 'sandbox', '18A2', '2026-07-01', '2026-09-30', '{}', repeat('d', 64), gen_random_uuid(), '111', NULL, 'B')$q$,
    'COMPANY_CLOSED', 'no new HMRC submission for a closed company');
  PERFORM pg_temp.fails($q$UPDATE public.organizations SET name = 'Back again', closed_at = NULL WHERE id = '0b700000-0000-4000-8000-000000000001'$q$, 'COMPANY_CLOSED', 'a closed company can''t be reopened or renamed');
  PERFORM pg_temp.fails($q$DELETE FROM public.organizations WHERE id = '0b700000-0000-4000-8000-000000000001'$q$, 'COMPANY_CLOSED', 'the shell is removed only by the purge');
  PERFORM pg_temp.fails($q$DELETE FROM public.organizations WHERE id = '0e700000-0000-4000-8000-000000000001'$q$, 'foreign key', 'RESTRICT still holds: an open company with a submission can''t be deleted');
  PERFORM pg_temp.ok(EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'organizations' AND policyname = 'data_rights_hide_closed' AND permissive = 'RESTRICTIVE' AND qual LIKE '%closed_at IS NULL%'),
    'closed companies are hidden from signed-in people by a restrictive policy');
END $$;
SELECT pg_temp.as_user('f7000000-0000-4000-8000-00000000000b');
SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT count(*) FROM public.organizations WHERE id = '0b700000-0000-4000-8000-000000000001') = 0, 'B no longer sees Y');
END $$;
RESET ROLE;

\echo '== account deletion: refusals'
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SET ROLE service_role;
DO $$ DECLARE j jsonb; BEGIN
  j := public.data_rights_delete_account('f7000000-0000-4000-8000-00000000000a', NULL, false);
  PERFORM pg_temp.ok(j->>'result' = 'refused' AND j->'reasons' ? 'last_owner' AND j->'last_owner_of' ? 'Company X',
    'A is the last owner of X, which has other members: refused (transfer ownership or close X first)');
  j := public.data_rights_delete_account('f7000000-0000-4000-8000-0000000000f1', NULL, false);
  PERFORM pg_temp.ok(j->>'result' = 'refused' AND j->'reasons' ? 'paid_subscription', 'P has a live paid subscription: refused (cancel it in the billing portal first)');
  j := public.data_rights_delete_account('f7000000-0000-4000-8000-0000000000f2', NULL, false);
  PERFORM pg_temp.ok(j->>'result' = 'refused' AND j->'reasons' ? 'billing_user' AND j->'pays_for' ? 'Company X', 'Q pays for X, which stays open: refused');
  j := public.data_rights_delete_account('f7000000-0000-4000-8000-0000000000e6', NULL, false);
  PERFORM pg_temp.ok(j->>'result' = 'demo', 'the demo account is refused');
  j := public.data_rights_delete_account('f7000000-0000-4000-8000-0000000000ff', NULL, false);
  PERFORM pg_temp.ok(j->>'result' = 'not_found', 'someone who doesn''t exist: not_found');
  PERFORM pg_temp.ok((SELECT count(*) FROM auth.users WHERE id::text LIKE 'f7000000%') = 8, 'no refusal deleted anyone');
  j := public.data_rights_delete_account('f7000000-0000-4000-8000-00000000000e', NULL, true);
  PERFORM pg_temp.ok(j->>'result' = 'ok' AND j->'companies_closed' ? 'Company W', 'check only: E is told Company W will be closed');
  PERFORM pg_temp.ok(EXISTS (SELECT 1 FROM auth.users WHERE id = 'f7000000-0000-4000-8000-00000000000e'), 'the check deleted nothing');
END $$;

\echo '== account deletion: a sole owner (E, company W with an HMRC submission)'
DO $$ DECLARE j jsonb; BEGIN
  j := public.data_rights_delete_account('f7000000-0000-4000-8000-00000000000e', NULL, false);
  PERFORM pg_temp.ok(j->>'result' = 'deleted' AND (j->>'companies_closed')::int = 1 AND j->'closed_ids' ? '0e700000-0000-4000-8000-000000000001',
    'E is deleted and W is closed (its id is returned so its files can be removed)');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM auth.users WHERE id = 'f7000000-0000-4000-8000-00000000000e')
    AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = 'f7000000-0000-4000-8000-00000000000e'), 'the sign-in and the profile are gone');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.notes WHERE user_id = 'f7000000-0000-4000-8000-00000000000e'), 'their own rows are gone');
  PERFORM pg_temp.ok((SELECT name FROM public.organizations WHERE id = '0e700000-0000-4000-8000-000000000001') = 'Closed company', 'W is a closed shell');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.hmrc_connections WHERE company_id = '0e700000-0000-4000-8000-000000000001'), 'W''s HMRC tokens are gone');
  PERFORM pg_temp.ok((SELECT submitted_by_name = 'Deleted user' AND submitted_by = 'f7000000-0000-4000-8000-00000000000e' AND figures = '{"netVatDue": 145.00}'::jsonb
    FROM public.hmrc_vat_submissions WHERE organization_id = '0e700000-0000-4000-8000-000000000001'),
    'the submission stays: "Deleted user", the opaque id, the figures exactly as sent');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.hmrc_audit_log WHERE user_id = 'f7000000-0000-4000-8000-00000000000e') >= 1, 'the HMRC trail keeps the opaque id');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.ai_credit_ledger WHERE user_id IS NULL AND note = 'spend') = 1, 'the AI credit ledger keeps the row without the person');
  PERFORM pg_temp.ok(NOT public._data_rights_gate_is_open('anonymise') AND NOT public._data_rights_gate_is_open('company_close'), 'the gates are shut again afterwards');
END $$;

\echo '== account deletion: a member of a company that stays (C in X)'
DO $$ DECLARE j jsonb; BEGIN
  j := public.data_rights_delete_account('f7000000-0000-4000-8000-00000000000c', NULL, false);
  PERFORM pg_temp.ok(j->>'result' = 'deleted' AND (j->>'companies_closed')::int = 0, 'C is deleted; X stays open');
  PERFORM pg_temp.ok((SELECT user_id FROM public.invoices WHERE invoice_number = 'X-C-1') = 'f7000000-0000-4000-8000-00000000000a',
    'the invoice C made for X now belongs to X''s owner (the company keeps its books)');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.invoices WHERE invoice_number = 'C-PERSONAL-1'), 'C''s personal invoice (no company) is gone');
  PERFORM pg_temp.ok((SELECT invited_by FROM public.organization_members WHERE user_id = 'f7000000-0000-4000-8000-00000000000d') IS NULL, '"invited by C" is forgotten');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.organization_members WHERE organization_id = '0a700000-0000-4000-8000-000000000001') = 4, 'X keeps its other members');
  PERFORM pg_temp.ok((SELECT name FROM public.organizations WHERE id = '0a700000-0000-4000-8000-000000000001') = 'Company X', 'X is untouched');
  PERFORM pg_temp.ok((SELECT assigned_to FROM public.todos WHERE id = '0a7000bb-0000-4000-8000-000000000001') IS NULL
    AND (SELECT user_id FROM public.todos WHERE id = '0a7000bb-0000-4000-8000-000000000001') = 'f7000000-0000-4000-8000-00000000000a',
    'the X task assigned to C is unassigned and stays with X');
  PERFORM pg_temp.ok(EXISTS (SELECT 1 FROM public.todo_history WHERE todo_id = '0a7000bb-0000-4000-8000-000000000001' AND field_name = 'assigned_to'
    AND old_value = 'f7000000-0000-4000-8000-00000000000c' AND user_id = 'f7000000-0000-4000-8000-00000000000a'),
    'the task history records the change under the task''s owner (it needs a person)');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.project_time_entries WHERE user_id = 'f7000000-0000-4000-8000-00000000000c'),
    'C''s time entries go with C (never moved to someone else; the time guard forbids an owner change)');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.hmrc_settings WHERE organization_id = '0a700000-0000-4000-8000-000000000001') = 1
    AND EXISTS (SELECT 1 FROM public.hmrc_settings WHERE organization_id = '0a700000-0000-4000-8000-000000000001' AND user_id = 'f7000000-0000-4000-8000-00000000000a'),
    'X keeps the owner''s HMRC settings; C''s duplicate goes (one row per person and company)');
  PERFORM pg_temp.ok(current_setting('request.jwt.claims', true) = '{"role":"service_role"}', 'the caller''s claims are put back afterwards');
END $$;

\echo '== retention purge'
DO $$ DECLARE v_subs bigint; v_audit bigint; v_orgs bigint; v_before bigint; BEGIN
  SELECT count(*) INTO v_before FROM public.hmrc_vat_submissions;
  SELECT rows INTO v_subs FROM public.hmrc_purge_expired_audit() WHERE item = 'vat_submissions';
  SELECT rows INTO v_audit FROM public.hmrc_purge_expired_audit(true) WHERE item = 'audit_log';
  SELECT rows INTO v_orgs FROM public.hmrc_purge_expired_audit(true) WHERE item = 'closed_companies';
  PERFORM pg_temp.ok(v_subs = 1 AND v_audit = 1 AND v_orgs = 0, 'dry run (the default): 1 old sandbox submission, 1 audit row over 6 years, no closed company is free yet');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.hmrc_vat_submissions) = v_before AND EXISTS (SELECT 1 FROM public.hmrc_audit_log WHERE created_at < now() - interval '6 years'),
    'the dry run deleted nothing');
  PERFORM pg_temp.ok((SELECT rows FROM public.hmrc_purge_expired_audit(false) WHERE item = 'vat_submissions') = 1, 'the real purge removes the expired submission');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.hmrc_vat_submissions WHERE period_key = '17A1') AND (SELECT count(*) FROM public.hmrc_vat_submissions) = v_before - 1,
    'only the expired one');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.hmrc_audit_log WHERE created_at < now() - interval '6 years') AND EXISTS (SELECT 1 FROM public.hmrc_audit_log),
    'only audit rows over 6 years are removed');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.organizations WHERE closed_at IS NOT NULL) = 2, 'closed companies with a recent submission stay');
  PERFORM pg_temp.ok(NOT public._data_rights_gate_is_open('hmrc_purge'), 'the purge gate is shut afterwards');
  PERFORM pg_temp.fails($q$DELETE FROM public.hmrc_vat_submissions$q$, 'permission denied', 'after the purge, a direct delete is refused again');
END $$;
RESET ROLE;
-- A closed company whose last submission has expired is removed by the purge.
ALTER TABLE public.hmrc_vat_submissions DISABLE TRIGGER USER;
UPDATE public.hmrc_vat_submissions SET period_end = '2020-03-31', period_start = '2020-01-01' WHERE organization_id = '0b700000-0000-4000-8000-000000000001';
ALTER TABLE public.hmrc_vat_submissions ENABLE TRIGGER USER;
SET ROLE service_role;
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT rows FROM public.hmrc_purge_expired_audit(true) WHERE item = 'closed_companies') = 1, 'dry run: Y is free once its submission has expired');
  PERFORM public.hmrc_purge_expired_audit(false);
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = '0b700000-0000-4000-8000-000000000001')
    AND EXISTS (SELECT 1 FROM public.organizations WHERE id = '0e700000-0000-4000-8000-000000000001'), 'the purge removes Y''s shell and keeps W''s');
END $$;
RESET ROLE;
DO $$ BEGIN
  PERFORM pg_temp.fails($q$DELETE FROM public.hmrc_vat_submissions$q$, 'HMRC_VAT_SUBMISSION_IMMUTABLE',
    'in the same transaction as a purge, the table owner still can''t delete afterwards (the gate closed with the function)');
  PERFORM pg_temp.fails($q$DELETE FROM public.hmrc_audit_log$q$, 'HMRC_AUDIT_APPEND_ONLY', 'nor delete audit rows');
END $$;

ROLLBACK;
