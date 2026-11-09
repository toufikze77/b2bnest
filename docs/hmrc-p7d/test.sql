-- HMRC P7d tests (DISPOSABLE local Postgres only). Run by docs/hmrc-p7d/run-test.sh after production's shape,
-- docs/hmrc-p7d/fixture.sql and docs/hmrc-p7d/proposal.sql. One transaction, rolled back. Fictional people only.
-- Company A: user A (owner) with project PA. Company B: user B (owner) with project PB. Each has one own invoice.
\set ON_ERROR_STOP 1
BEGIN;
\i docs/phase37/test-helpers.sql
INSERT INTO auth.users (id, email) VALUES ('f7d00000-0000-4000-8000-00000000000a', 'a@example.test'), ('f7d00000-0000-4000-8000-00000000000b', 'b@example.test');
INSERT INTO public.organizations (id, name, slug) VALUES ('0a7d0000-0000-4000-8000-000000000001', 'Company A', 'company-a'), ('0b7d0000-0000-4000-8000-000000000001', 'Company B', 'company-b');
INSERT INTO public.organization_members (organization_id, user_id, role, is_active) VALUES
  ('0a7d0000-0000-4000-8000-000000000001', 'f7d00000-0000-4000-8000-00000000000a', 'owner', true),
  ('0b7d0000-0000-4000-8000-000000000001', 'f7d00000-0000-4000-8000-00000000000b', 'owner', true);
INSERT INTO public.projects (id, user_id, name, organization_id) VALUES
  ('0a7d00aa-0000-4000-8000-000000000001', 'f7d00000-0000-4000-8000-00000000000a', 'PA', '0a7d0000-0000-4000-8000-000000000001'),
  ('0b7d00bb-0000-4000-8000-000000000001', 'f7d00000-0000-4000-8000-00000000000b', 'PB', '0b7d0000-0000-4000-8000-000000000001');
INSERT INTO public.invoices (user_id, organization_id, invoice_number) VALUES
  ('f7d00000-0000-4000-8000-00000000000a', '0a7d0000-0000-4000-8000-000000000001', 'A-1'),
  ('f7d00000-0000-4000-8000-00000000000b', '0b7d0000-0000-4000-8000-000000000001', 'B-1');
INSERT INTO public.organization_invitations (organization_id, email, role, token) VALUES
  ('0a7d0000-0000-4000-8000-000000000001', 'new@example.test', 'member', 'fixture-token-not-real');
INSERT INTO public.template_events (template_slug, event_type) VALUES ('invoice-basic', 'view');
CREATE FUNCTION pg_temp.as_user(u text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated', 'aal', 'aal1')::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.as_user(text) TO PUBLIC;

\echo '== signed out (anon): the five revoked helpers are refused'
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SET ROLE anon;
DO $$ BEGIN
  PERFORM pg_temp.fails($q$SELECT public.is_project_member('0a7d00aa-0000-4000-8000-000000000001', 'f7d00000-0000-4000-8000-00000000000a')$q$, 'permission denied', 'anon: is_project_member refused');
  PERFORM pg_temp.fails($q$SELECT public.is_team_member(gen_random_uuid(), 'f7d00000-0000-4000-8000-00000000000a')$q$, 'permission denied', 'anon: is_team_member refused');
  PERFORM pg_temp.fails($q$SELECT public.owns_team(gen_random_uuid(), 'f7d00000-0000-4000-8000-00000000000a')$q$, 'permission denied', 'anon: owns_team refused');
  PERFORM pg_temp.fails($q$SELECT public.user_can_access_project('0a7d00aa-0000-4000-8000-000000000001', 'f7d00000-0000-4000-8000-00000000000a')$q$, 'permission denied', 'anon: user_can_access_project refused');
  PERFORM pg_temp.fails($q$SELECT * FROM public.get_invitation_by_token('fixture-token-not-real')$q$, 'permission denied', 'anon: get_invitation_by_token refused (no invited email, role or company to a token holder)');
END $$;

\echo '== signed out (anon): what is kept still answers'
DO $$ BEGIN
  PERFORM public.email_unsubscribe('not-a-token');
  PERFORM public.email_unsubscribe(repeat('a', 64));
  PERFORM pg_temp.ok(true, 'anon: email_unsubscribe still works (64-hex token, opt-out only)');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.template_usage_counts() WHERE slug = 'invoice-basic') = 1, 'anon: template_usage_counts still answers (aggregates only)');
  PERFORM pg_temp.ok(public.is_super_admin('f7d00000-0000-4000-8000-00000000000a') = false, 'anon: is_super_admin kept (a public-role policy evaluates it)');
  PERFORM pg_temp.ok(public.has_role('f7d00000-0000-4000-8000-00000000000a', 'admin') = false, 'anon: has_role kept (a public-role policy evaluates it)');
  PERFORM pg_temp.ok(public.user_owns_project('0a7d00aa-0000-4000-8000-000000000001', 'f7d00000-0000-4000-8000-00000000000a'), 'anon: user_owns_project kept (a public-role policy evaluates it)');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.template_catalog) >= 0 AND (SELECT count(*) FROM public.news_articles) >= 0 AND (SELECT count(*) FROM public.job_postings) >= 0,
    'anon: the public pages'' tables (templates, news, jobs) still read');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.hmrc_submission_logs) = 0, 'anon: a table whose public-role policy calls a kept helper still reads (no error, no rows)');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.projects) = 0 AND (SELECT count(*) FROM public.invoices) = 0, 'anon: no project or invoice rows');
END $$;
RESET ROLE;

\echo '== why the seven are kept: a public-role policy needs the caller to hold EXECUTE (proved in a savepoint)'
SAVEPOINT why_kept;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_owner(uuid) FROM anon, PUBLIC;
SET ROLE anon;
DO $$ BEGIN
  PERFORM pg_temp.fails($q$SELECT count(*) FROM public.hmrc_submission_logs$q$, 'permission denied for function is_admin_or_owner',
    'without its grant, an anonymous read of a table with a public-role policy fails: so those helpers stay');
END $$;
RESET ROLE;
ROLLBACK TO SAVEPOINT why_kept;

\echo '== signed in (authenticated): the helpers still work; company A sees A, never B'
SELECT pg_temp.as_user('f7d00000-0000-4000-8000-00000000000a');
SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.ok(public.user_can_access_project('0a7d00aa-0000-4000-8000-000000000001', 'f7d00000-0000-4000-8000-00000000000a'), 'authenticated: user_can_access_project still runs (A, own project)');
  PERFORM pg_temp.ok(NOT public.user_can_access_project('0b7d00bb-0000-4000-8000-000000000001', 'f7d00000-0000-4000-8000-00000000000a'), 'authenticated: and says no for B''s project');
  PERFORM pg_temp.ok(public.is_project_member('0a7d00aa-0000-4000-8000-000000000001', 'f7d00000-0000-4000-8000-00000000000a') IS NOT NULL, 'authenticated: is_project_member still runs');
  PERFORM pg_temp.ok(public.is_team_member(gen_random_uuid(), 'f7d00000-0000-4000-8000-00000000000a') = false AND public.owns_team(gen_random_uuid(), 'f7d00000-0000-4000-8000-00000000000a') = false,
    'authenticated: is_team_member and owns_team still run');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.get_invitation_by_token('fixture-token-not-real')) = 1, 'authenticated: get_invitation_by_token still runs');
  PERFORM pg_temp.ok((SELECT array_agg(name ORDER BY name) FROM public.projects) = ARRAY['PA'], 'A: sees project PA only, never PB');
  PERFORM pg_temp.ok((SELECT array_agg(invoice_number) FROM public.invoices) = ARRAY['A-1'], 'A: sees invoice A-1 only, never B-1');
  INSERT INTO public.invoices (user_id, organization_id, invoice_number) VALUES ('f7d00000-0000-4000-8000-00000000000a', '0a7d0000-0000-4000-8000-000000000001', 'A-2');
  UPDATE public.invoices SET invoice_number = 'A-2b' WHERE invoice_number = 'A-2';
  PERFORM pg_temp.ok((SELECT count(*) FROM public.invoices WHERE invoice_number = 'A-2b') = 1, 'A: can still create and edit their own invoice');
  UPDATE public.invoices SET invoice_number = 'hacked' WHERE invoice_number = 'B-1';
  PERFORM pg_temp.fails($q$INSERT INTO public.invoices (user_id, organization_id, invoice_number) VALUES ('f7d00000-0000-4000-8000-00000000000b', NULL, 'B-x')$q$,
    'row-level security', 'A: cannot create an invoice as B (row-level security)');
  PERFORM pg_temp.fails($q$INSERT INTO public.invoices (user_id, organization_id, invoice_number) VALUES ('f7d00000-0000-4000-8000-00000000000a', '0b7d0000-0000-4000-8000-000000000001', 'A-in-B')$q$,
    'FINANCE_COMPANY_NOT_MEMBER', 'A: cannot put an invoice in company B');
END $$;
RESET ROLE;
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT count(*) FROM public.invoices WHERE invoice_number = 'B-1') = 1, 'B''s invoice is unchanged after A''s attempt');
END $$;
SELECT pg_temp.as_user('f7d00000-0000-4000-8000-00000000000b');
SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT array_agg(name ORDER BY name) FROM public.projects) = ARRAY['PB'], 'B: sees project PB only');
END $$;
RESET ROLE;

\echo '== nothing else changed'
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind IN ('r', 'p')) = 148, 'no table added or dropped (148)');
  PERFORM pg_temp.ok((SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.get_invitation_by_token(text)'::regprocedure) = 'dc1a3743a222906f765a033a91600a35', 'function bodies unchanged');
  PERFORM pg_temp.ok(has_function_privilege('service_role', 'public.get_invitation_by_token(text)', 'EXECUTE') AND has_function_privilege('service_role', 'public.owns_team(uuid,uuid)', 'EXECUTE'),
    'service_role keeps EXECUTE');
END $$;
ROLLBACK;
