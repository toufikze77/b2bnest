-- Phase 25 test (local replica only; run-test.sh). Before → apply → every rule → rollback restores every body exactly.
\set ON_ERROR_STOP 1
SET check_function_bodies = off;
CREATE TABLE p25r(n serial, name text, ok bool, detail text);
CREATE FUNCTION p25ok(name text, cond bool, detail text DEFAULT '') RETURNS void LANGUAGE sql AS $$ INSERT INTO p25r(name, ok, detail) VALUES (name, coalesce(cond, false), detail) $$;
-- Run a query as a signed-in user at a given assurance level ('aal1' = password only, 'aal2' = code entered) and return
-- its text value, or the error. role = 'service_role' / 'anon' runs it as those roles instead.
CREATE FUNCTION p25as(u uuid, aal text, q text, r text DEFAULT 'authenticated') RETURNS text LANGUAGE plpgsql AS $$ DECLARE v text; BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', r, 'aal', aal)::text, true);
  EXECUTE format('SET LOCAL ROLE %I', r);
  BEGIN EXECUTE q INTO v; EXCEPTION WHEN others THEN v := 'ERROR ' || SQLERRM; END;
  RESET ROLE; PERFORM set_config('request.jwt.claims', '{}', true); RETURN coalesce(v, 'null'); END $$;
GRANT ALL ON p25r TO anon, authenticated, service_role; GRANT USAGE ON SEQUENCE p25r_n_seq TO anon, authenticated, service_role;

-- People (no real data). E: authenticator app set up. P: no app. X: only a half-finished (unverified) set-up.
-- SA: super admin without an app. SB: super admin with an app.
\set E  '''e0000000-0000-4000-8000-000000000001'''
\set P  '''e0000000-0000-4000-8000-000000000002'''
\set X  '''e0000000-0000-4000-8000-000000000003'''
\set SA '''e0000000-0000-4000-8000-000000000004'''
\set SB '''e0000000-0000-4000-8000-000000000005'''
INSERT INTO auth.users(id, email) VALUES (:E, 'e@example.test'), (:P, 'p@example.test'), (:X, 'x@example.test'), (:SA, 'sa@example.test'), (:SB, 'sb@example.test');
INSERT INTO public.profiles(id, email) SELECT id, email FROM auth.users WHERE email LIKE '%@example.test' ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_roles(user_id, role) VALUES (:SA, 'super_admin'), (:SB, 'super_admin');
INSERT INTO auth.mfa_factors(user_id, status) VALUES (:E, 'verified'), (:SB, 'verified'), (:X, 'unverified');
INSERT INTO public.bank_accounts(user_id, account_id, provider_id, provider_name, account_type) SELECT u, 'acc', 'prov', 'Bank', 'current' FROM unnest(ARRAY[:E, :P, :X]::uuid[]) u;
INSERT INTO public.hmrc_submission_logs(user_id, submission_type) SELECT u, 'vat_preview' FROM unnest(ARRAY[:E, :P, :X]::uuid[]) u;
INSERT INTO public.crm_contacts(user_id, name) SELECT u, 'Contact' FROM unnest(ARRAY[:E, :P, :X]::uuid[]) u;
INSERT INTO public.documents(user_id, title, category) SELECT u, 'Doc', 'legal' FROM unnest(ARRAY[:E, :P, :X]::uuid[]) u;
INSERT INTO public.subscribers(user_id, email) SELECT id, email FROM auth.users WHERE id IN (:E, :P, :X);
INSERT INTO public.invoices(user_id, invoice_number) SELECT u, 'INV-' || u FROM unnest(ARRAY[:E, :P, :X]::uuid[]) u;
INSERT INTO public.payroll_employees(user_id, first_name, last_name, ni_number) SELECT u, 'A', 'B', 'QQ123456C' FROM unnest(ARRAY[:E, :P, :X]::uuid[]) u;

-- The sample: one table per category (profile, bank, HMRC, CRM, documents, billing, invoices, payroll).
CREATE TABLE p25samples(cat text, q text);
INSERT INTO p25samples VALUES
  ('profile data', 'select count(*)::text from public.profiles where id = auth.uid()'),
  ('bank', 'select count(*)::text from public.bank_accounts'),
  ('HMRC', 'select count(*)::text from public.hmrc_submission_logs'),
  ('CRM', 'select count(*)::text from public.crm_contacts'),
  ('documents', 'select count(*)::text from public.documents where user_id = auth.uid()'),
  ('subscribers (billing)', 'select count(*)::text from public.subscribers where user_id = auth.uid()'),
  ('invoices', 'select count(*)::text from public.invoices'),
  ('payroll', 'select count(*)::text from public.payroll_employees');
GRANT SELECT ON p25samples TO authenticated;

-- Anonymous visitors: what every table answers today (count or error), to compare after.
CREATE TABLE p25anon(t text PRIMARY KEY, before text, after text);
INSERT INTO p25anon(t) SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE 'p25%';
UPDATE p25anon SET before = p25as(NULL, NULL, format('select count(*)::text from public.%I', t), 'anon');
-- Function bodies today (rollback must restore these exactly).
CREATE TABLE p25bodies AS SELECT p.oid::regprocedure::text AS fn, md5(p.prosrc) AS md5 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public';

-- Today (before Phase 25): a password-only session of someone with an app reads everything.
SELECT p25ok('BEFORE: today a password-only (aal1) session of an enrolled user reads their bank accounts',
  p25as(:E, 'aal1', 'select count(*)::text from public.bank_accounts') = '1');

\i proposal.test.sql

-- ===== After =====
SELECT p25ok(format('enrolled user, aal1: %s refused (no rows)', cat), p25as(:E, 'aal1', q) = '0', p25as(:E, 'aal1', q)) FROM p25samples;
SELECT p25ok(format('enrolled user, aal2: %s works', cat), p25as(:E, 'aal2', q) = '1', p25as(:E, 'aal2', q)) FROM p25samples;
SELECT p25ok(format('no app, aal1: %s works (optional for everyone)', cat), p25as(:P, 'aal1', q) = '1', p25as(:P, 'aal1', q)) FROM p25samples;
SELECT p25ok(format('only a half-finished (unverified) set-up, aal1: %s works', cat), p25as(:X, 'aal1', q) = '1') FROM p25samples;

SELECT p25ok('enrolled user, aal1: cannot insert (WITH CHECK)',
  p25as(:E, 'aal1', $$insert into public.crm_contacts(user_id, name) values (auth.uid(), 'New') returning 'inserted'$$) LIKE 'ERROR new row violates row-level security policy%');
SELECT p25ok('enrolled user, aal1: cannot update or delete',
  p25as(:E, 'aal1', $$with u as (update public.crm_contacts set name = 'Changed' returning 1), d as (delete from public.bank_accounts returning 1) select ((select count(*) from u) + (select count(*) from d))::text$$) = '0');
SELECT p25ok('enrolled user, aal2: can insert',
  p25as(:E, 'aal2', $$insert into public.crm_contacts(user_id, name) values (auth.uid(), 'New') returning 'inserted'$$) = 'inserted');

-- SECURITY DEFINER functions (they bypass RLS, so they carry the guard themselves).
SELECT p25ok(format('enrolled user, aal1: %s refused with MFA_REQUIRED', f), p25as(:E, 'aal1', q) = 'ERROR MFA_REQUIRED', p25as(:E, 'aal1', q))
FROM (VALUES ('get_bank_accounts_safe', format('select count(*)::text from public.get_bank_accounts_safe(%L)', :E)),
             ('get_hmrc_tokens', format('select public.get_hmrc_tokens(%L)::text', :E)),
             ('get_user_payments', format('select count(*)::text from public.get_user_payments(%L)', :E)),
             ('check_trial_status', format('select public.check_trial_status(%L)::text', :E)),
             ('my_access_state', 'select count(*)::text from public.my_access_state()'),
             ('get_user_staking_tier (SQL function)', format('select public.get_user_staking_tier(%L)::text', :E))) v(f, q);
SELECT p25ok(format('enrolled user, aal2: %s is not refused', f), p25as(:E, 'aal2', q) NOT LIKE 'ERROR MFA_REQUIRED%', p25as(:E, 'aal2', q))
FROM (VALUES ('get_bank_accounts_safe', format('select count(*)::text from public.get_bank_accounts_safe(%L)', :E)),
             ('get_user_payments', format('select count(*)::text from public.get_user_payments(%L)', :E)),
             ('my_access_state', 'select count(*)::text from public.my_access_state()')) v(f, q);
SELECT p25ok('no app, aal1: get_user_projects works', p25as(:P, 'aal1', format('select count(*)::text from public.get_user_projects(%L)', :P)) NOT LIKE 'ERROR%', p25as(:P, 'aal1', format('select count(*)::text from public.get_user_projects(%L)', :P)));

-- Admin RPCs: super admins need aal2 always (security_settings.admin_requires_aal2 = true), even without an app.
SELECT p25ok('super admin WITHOUT an app, aal1: admin_overview_stats refused (MFA_REQUIRED)', p25as(:SA, 'aal1', 'select public.admin_overview_stats()::text') = 'ERROR MFA_REQUIRED');
SELECT p25ok('super admin with an app, aal1: admin_list_users refused', p25as(:SB, 'aal1', $$select public.admin_list_users(null, 'all', 10, 0, 'all')::text$$) = 'ERROR MFA_REQUIRED');
SELECT p25ok('super admin, aal2: admin_system_health works', p25as(:SB, 'aal2', 'select public.admin_system_health()::text') NOT LIKE 'ERROR%', p25as(:SB, 'aal2', 'select public.admin_system_health()::text'));
SELECT p25ok('a non-admin still gets the function''s own refusal, not MFA_REQUIRED', p25as(:P, 'aal1', 'select public.admin_overview_stats()::text') NOT LIKE 'ERROR MFA_REQUIRED%', p25as(:P, 'aal1', 'select public.admin_overview_stats()::text'));
UPDATE public.security_settings SET admin_requires_aal2 = false;
SELECT p25ok('owner switch off: super admin without an app, aal1, can use Admin again', p25as(:SA, 'aal1', 'select public.admin_system_health()::text') NOT LIKE 'ERROR%', p25as(:SA, 'aal1', 'select public.admin_system_health()::text'));
UPDATE public.security_settings SET admin_requires_aal2 = true;

-- Server paths.
SELECT p25ok('service_role: reads every row, whatever the assurance level', p25as(NULL, NULL, 'select count(*)::text from public.bank_accounts', 'service_role') = '3');
SELECT p25ok('service_role: guarded functions work', p25as(:E, NULL, format('select count(*)::text from public.get_user_projects(%L)', :E), 'service_role') NOT LIKE 'ERROR%', p25as(:E, NULL, format('select count(*)::text from public.get_user_projects(%L)', :E), 'service_role'));
SELECT p25ok('postgres (SQL editor): mfa_ok() is true', public.mfa_ok());

-- Anonymous visitors unchanged on every table.
UPDATE p25anon SET after = p25as(NULL, NULL, format('select count(*)::text from public.%I', t), 'anon');
SELECT p25ok('anon: every table answers exactly as before', NOT EXISTS (SELECT 1 FROM p25anon WHERE before IS DISTINCT FROM after),
  (SELECT string_agg(t || ': ' || before || ' → ' || after, '; ') FROM p25anon WHERE before IS DISTINCT FROM after));
SELECT p25ok('the new policies apply to authenticated only (anon untouched)',
  NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'require_aal2_if_enrolled' AND roles <> '{authenticated}'::name[]));
SELECT p25ok('the new policies are RESTRICTIVE', NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'require_aal2_if_enrolled' AND permissive <> 'RESTRICTIVE'));
SELECT p25ok('98 tables carry the policy', (SELECT count(*) FROM pg_policies WHERE policyname = 'require_aal2_if_enrolled') = 98);
SELECT p25ok('public content tables are not covered (news, forum, template catalogue)',
  NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'require_aal2_if_enrolled' AND tablename IN ('news_articles', 'forum_posts', 'forum_replies', 'template_catalog', 'template_events', 'advertisement_categories', 'job_postings')));
SELECT p25ok('mfa_ok / require_* : anon may not execute; authenticated may',
  NOT has_function_privilege('anon', 'public.mfa_ok()', 'EXECUTE') AND NOT has_function_privilege('anon', 'public.require_aal2_if_enrolled()', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.mfa_ok()', 'EXECUTE'));
SELECT p25ok('mfa_ok, require_aal2_if_enrolled and require_aal2_admin use search_path = ''''',
  (SELECT bool_and(p.proconfig @> ARRAY['search_path=""']) FROM pg_proc p WHERE p.oid IN ('public.mfa_ok()'::regprocedure, 'public.require_aal2_if_enrolled()'::regprocedure, 'public.require_aal2_admin()'::regprocedure)));
SELECT p25ok('security_settings and the guard log: no access for anon/authenticated',
  NOT has_table_privilege('authenticated', 'public.security_settings', 'SELECT') AND NOT has_table_privilege('anon', 'public.phase25_mfa_guard_log', 'SELECT'));
SELECT p25ok('guarded functions keep their grants and SECURITY DEFINER',
  (SELECT bool_and(p.prosecdef AND has_function_privilege('authenticated', p.oid, 'EXECUTE')) FROM public.phase25_mfa_guard_log g JOIN pg_proc p ON p.oid = to_regprocedure(g.fn)));

-- ===== Rollback =====
\i rollback.sql
SELECT p25ok('rollback: every function body is back exactly (md5 of all public functions as before)',
  NOT EXISTS (SELECT 1 FROM p25bodies b WHERE (SELECT md5(p.prosrc) FROM pg_proc p WHERE p.oid = to_regprocedure(b.fn)) IS DISTINCT FROM b.md5));
SELECT p25ok('rollback: no policy, helper or table left', NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'require_aal2_if_enrolled')
  AND to_regprocedure('public.mfa_ok()') IS NULL AND to_regclass('public.security_settings') IS NULL);
SELECT p25ok('rollback: an enrolled aal1 session reads its data again (as today)', p25as(:E, 'aal1', 'select count(*)::text from public.bank_accounts') = '1');

SELECT CASE WHEN ok THEN 'PASS|' ELSE 'FAIL|' END || name || CASE WHEN ok OR detail = '' THEN '' ELSE ' :: ' || detail END FROM p25r ORDER BY n;
SELECT 'TOTAL|' || count(*) FILTER (WHERE ok) || '/' || count(*) FROM p25r;
