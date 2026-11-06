-- Demo read-only: the suite (run by run-test.sh after proposal.sql, on a disposable local Postgres).
\i docs/phase37/test-helpers.sql
-- Fictional people only. DEMO is view only; NORMAL is any other signed-in person (never added to the list).
INSERT INTO auth.users (id, email) VALUES
  ('de00de00-0000-4000-8000-000000000001', 'demo@example.test'),
  ('0a0a0a0a-0000-4000-8000-00000000000a', 'normal@example.test') ON CONFLICT DO NOTHING;
-- The owner's one statement (README step 4), with the fictional id.
INSERT INTO public.demo_readonly_users (user_id, label) VALUES ('de00de00-0000-4000-8000-000000000001', 'demo');
-- Rows to read, change and delete.
INSERT INTO public.todos (id, user_id, note) VALUES ('de00de00-0000-4000-8000-0000000000a1', 'de00de00-0000-4000-8000-000000000001', 'demo task');
INSERT INTO public.invoices (id, user_id, note) VALUES ('de00de00-0000-4000-8000-0000000000a2', 'de00de00-0000-4000-8000-000000000001', 'demo invoice');
INSERT INTO public.notifications (id, user_id, note) VALUES ('de00de00-0000-4000-8000-0000000000a3', 'de00de00-0000-4000-8000-000000000001', 'unread');

-- An RPC a person can call (SECURITY DEFINER, like the app's own RPCs): writes stay refused because auth.uid() is theirs.
CREATE SCHEMA t3; GRANT USAGE ON SCHEMA t3 TO authenticated, anon, service_role;
CREATE FUNCTION t3.rpc_add_invoice(p_note text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN INSERT INTO public.invoices (user_id, note) VALUES (auth.uid(), p_note); END $$;
CREATE FUNCTION t3.rpc_spend_credit() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN UPDATE public.subscribers SET updated_at = now() WHERE user_id = auth.uid(); INSERT INTO public.ai_credit_ledger (user_id, note) VALUES (auth.uid(), 'spend'); END $$;
GRANT EXECUTE ON FUNCTION t3.rpc_add_invoice(text), t3.rpc_spend_credit() TO authenticated;
CREATE FUNCTION pg_temp.as_user(p uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated', 'aal', 'aal1')::text, false) $$;
CREATE FUNCTION pg_temp.code_of(sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN EXECUTE sql; RETURN 'none'; EXCEPTION WHEN OTHERS THEN RETURN SQLSTATE || ' ' || SQLERRM; END $$;
GRANT EXECUTE ON FUNCTION pg_temp.as_user(uuid), pg_temp.code_of(text) TO PUBLIC;

SELECT pg_temp.ok((SELECT count(*) FROM pg_trigger WHERE tgname = 'a0_demo_readonly_guard') = 133, '133 tables guarded');
SELECT pg_temp.ok((SELECT g.kind = 'user' AND g.new_md5 = md5(p.prosrc) AND g.old_md5 <> g.new_md5
  FROM public.phase25_mfa_guard_log g, pg_proc p WHERE g.fn = 'public.is_demo_readonly()' AND p.oid = 'public.is_demo_readonly()'::regprocedure),
  'is_demo_readonly has the Phase 25 guard line and its guard log row');
SELECT pg_temp.ok(NOT has_function_privilege('anon', 'public.is_demo_readonly()', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.is_demo_readonly()', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.demo_readonly_guard()', 'EXECUTE')
  AND NOT has_table_privilege('authenticated', 'public.demo_readonly_users', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.demo_readonly_users', 'SELECT'),
  'privileges: is_demo_readonly for signed-in people only; no client access to the list or the trigger function');
SELECT pg_temp.ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.demo_readonly_users'::regclass)
  AND EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'demo_readonly_users' AND policyname = 'require_aal2_if_enrolled' AND permissive = 'RESTRICTIVE'),
  'demo_readonly_users: RLS on with the restrictive aal2 policy');
SELECT pg_temp.ok((SELECT string_agg(tgname, ',' ORDER BY tgname COLLATE "C") FROM pg_trigger WHERE tgrelid = 'public.hmrc_audit_log'::regclass AND NOT tgisinternal) LIKE 'a0_demo_readonly_guard,%',
  'the guard sorts first among the table''s triggers');

-- ---------------------------------------------------------------- the demo person
SET ROLE authenticated;
SELECT pg_temp.as_user('de00de00-0000-4000-8000-000000000001');
SELECT pg_temp.ok(public.is_demo_readonly(), 'is_demo_readonly() is true for the demo person');
SELECT pg_temp.ok(pg_temp.code_of($q$INSERT INTO public.todos (user_id, note) VALUES (auth.uid(), 'x')$q$) = '42501 This is a demo account. It is view only.', 'demo: INSERT refused with 42501 and the message (todos)');
SELECT pg_temp.ok(pg_temp.code_of($q$UPDATE public.todos SET note = 'changed'$q$) LIKE '42501 This is a demo account%', 'demo: UPDATE refused (todos)');
SELECT pg_temp.ok(pg_temp.code_of($q$DELETE FROM public.invoices$q$) LIKE '42501 This is a demo account%', 'demo: DELETE refused (invoices)');
SELECT pg_temp.ok(pg_temp.code_of($q$INSERT INTO public.crm_contacts (user_id) VALUES (auth.uid())$q$) LIKE '42501 This is a demo account%', 'demo: INSERT refused (crm_contacts)');
SELECT pg_temp.ok(pg_temp.code_of($q$INSERT INTO public.documents (user_id) VALUES (auth.uid())$q$) LIKE '42501 This is a demo account%', 'demo: INSERT refused (documents)');
SELECT pg_temp.ok(pg_temp.code_of($q$INSERT INTO public.organization_members (organization_id, user_id, role) VALUES (gen_random_uuid(), auth.uid(), 'member')$q$) LIKE '42501 This is a demo account%', 'demo: INSERT refused (organization_members, a real fixture table)');
SELECT pg_temp.ok(pg_temp.code_of($q$INSERT INTO public.hmrc_settings (user_id) VALUES (auth.uid())$q$) LIKE '42501 This is a demo account%', 'demo: INSERT refused (hmrc_settings)');
SELECT pg_temp.ok(pg_temp.code_of($q$INSERT INTO public.todos (id, user_id) VALUES ('de00de00-0000-4000-8000-0000000000a1', auth.uid()) ON CONFLICT (id) DO NOTHING$q$) LIKE '42501 This is a demo account%', 'demo: INSERT ... ON CONFLICT DO NOTHING is refused too');
SELECT pg_temp.ok(pg_temp.code_of($q$SELECT t3.rpc_add_invoice('via rpc')$q$) LIKE '42501 This is a demo account%', 'demo: a write through an RPC (SECURITY DEFINER) is refused');
SELECT pg_temp.ok(pg_temp.code_of($q$SELECT t3.rpc_spend_credit()$q$) LIKE '42501 This is a demo account%', 'demo: spending credits through an RPC is refused (subscribers, ai_credit_ledger)');
SELECT pg_temp.ok((SELECT count(*) FROM public.todos) = 1 AND (SELECT count(*) FROM public.invoices) = 1 AND (SELECT note FROM public.todos) = 'demo task',
  'demo: reading works and nothing changed');
-- Sign-in and page loads: only allow-listed log / preference writes happen, and they work.
SELECT pg_temp.ok(pg_temp.code_of($q$INSERT INTO public.integration_audit_logs (user_id, note) VALUES (auth.uid(), 'cards loaded');
  INSERT INTO public.banking_audit_logs (user_id, note) VALUES (auth.uid(), 'accounts read');
  INSERT INTO public.audit_logs (user_id, note) VALUES (auth.uid(), 'profile read');
  INSERT INTO public.security_audit_logs (user_id, note) VALUES (auth.uid(), 'contact read');
  INSERT INTO public.payment_audit_logs (user_id, note) VALUES (auth.uid(), 'payments read');
  INSERT INTO public.user_notification_preferences (id, user_id) VALUES ('de00de00-0000-4000-8000-0000000000b1', auth.uid()) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_notification_preferences (id, user_id) VALUES ('de00de00-0000-4000-8000-0000000000b1', auth.uid()) ON CONFLICT (id) DO NOTHING;
  UPDATE public.notifications SET note = 'read' WHERE user_id = auth.uid();
  INSERT INTO public.user_favorites (user_id) VALUES (auth.uid())$q$) = 'none',
  'demo: page-load log writes, default preferences, notification read state and favourites still work');
SELECT pg_temp.ok(pg_temp.code_of($q$SELECT * FROM public.demo_readonly_users$q$) LIKE '42501 %permission denied%'
  AND pg_temp.code_of($q$DELETE FROM public.demo_readonly_users$q$) LIKE '42501 %permission denied%',
  'demo: cannot read the list or take themselves off it');
RESET ROLE;

-- ---------------------------------------------------------------- any other signed-in person keeps full write access
SET ROLE authenticated;
SELECT pg_temp.as_user('0a0a0a0a-0000-4000-8000-00000000000a');
SELECT pg_temp.ok(NOT public.is_demo_readonly(), 'is_demo_readonly() is false for a person not on the list');
SELECT pg_temp.ok(pg_temp.code_of($q$INSERT INTO public.todos (user_id, note) VALUES (auth.uid(), 'mine');
  UPDATE public.todos SET note = 'mine, changed' WHERE user_id = auth.uid();
  DELETE FROM public.todos WHERE user_id = auth.uid() AND note = 'mine, changed';
  INSERT INTO public.crm_contacts (user_id) VALUES (auth.uid());
  INSERT INTO public.hmrc_settings (user_id) VALUES (auth.uid());
  SELECT t3.rpc_add_invoice('normal via rpc'); SELECT t3.rpc_spend_credit()$q$) = 'none',
  'a person not in demo_readonly_users keeps full write access (direct and through an RPC)');
RESET ROLE;

-- ---------------------------------------------------------------- server paths are not affected
SET ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', false);
SELECT pg_temp.ok(pg_temp.code_of($q$INSERT INTO public.todos (user_id, note) VALUES ('de00de00-0000-4000-8000-000000000001', 'refreshed by the owner');
  UPDATE public.invoices SET note = 'refreshed'; INSERT INTO public.user_2fa_codes (user_id) VALUES ('de00de00-0000-4000-8000-000000000001')$q$) = 'none',
  'service role (Edge Functions, cron) can still write demo rows');
RESET ROLE;
SELECT set_config('request.jwt.claims', '', false);
SELECT pg_temp.ok(pg_temp.code_of($q$DELETE FROM public.todos WHERE note = 'refreshed by the owner'; UPDATE public.invoices SET note = 'demo invoice'$q$) = 'none',
  'the SQL editor (no JWT) can refresh the demo data');
SET ROLE anon;
SELECT pg_temp.ok(pg_temp.code_of($q$SELECT public.is_demo_readonly()$q$) LIKE '42501 %permission denied%', 'anon cannot call is_demo_readonly()');
SELECT pg_temp.ok(pg_temp.code_of($q$INSERT INTO public.template_events (note) VALUES ('signed-out view')$q$) = 'none', 'signed-out writes the app allows are unaffected (no auth.uid())');
RESET ROLE;

-- ---------------------------------------------------------------- taking someone off the list restores their access
DELETE FROM public.demo_readonly_users WHERE user_id = 'de00de00-0000-4000-8000-000000000001';
SET ROLE authenticated;
SELECT pg_temp.as_user('de00de00-0000-4000-8000-000000000001');
SELECT pg_temp.ok(pg_temp.code_of($q$UPDATE public.todos SET note = 'demo task' WHERE user_id = auth.uid()$q$) = 'none' AND NOT public.is_demo_readonly(),
  'off the list: writes work again at once');
RESET ROLE;
SELECT set_config('request.jwt.claims', '', false);
INSERT INTO public.demo_readonly_users (user_id, label) VALUES ('de00de00-0000-4000-8000-000000000001', 'demo');

-- ---------------------------------------------------------------- coverage (the failing case is in run-test.sh)
\o /dev/null
\i docs/demo-readonly/check-coverage.sql
\o
SELECT pg_temp.ok(true, 'coverage check passes after apply: every table in public is guarded or allowed');
DROP SCHEMA t3 CASCADE;
