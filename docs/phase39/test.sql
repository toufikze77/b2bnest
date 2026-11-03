-- Phase 39 tests (DISPOSABLE local Postgres only). Run by docs/phase39/run-test.sh after the shim and the Phase 35 / 36 /
-- 37 / 31 fixtures (mfa_ok, require_aal2_if_enrolled, the guard log and _access_state_for verbatim from production).
\set ON_ERROR_STOP 1
\i docs/phase37/test-helpers.sql

-- People (c9…0NN): 1 paying, 2 trial, 3 trial ended, 4 no profile and no plan, 5 suspended (paying), 6 two-step set up,
-- 7 deleted later (cascade), 8 signed up from the ROI Calculator and ticked the box, 10 did not tick it (odd source),
-- 11 another paying user.
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('c9000000-0000-4000-8000-000000000001', 'paying@example.test', '{}'),
  ('c9000000-0000-4000-8000-000000000002', 'trial@example.test', '{}'),
  ('c9000000-0000-4000-8000-000000000003', 'ended@example.test', '{}'),
  ('c9000000-0000-4000-8000-000000000004', 'noplan@example.test', '{}'),
  ('c9000000-0000-4000-8000-000000000005', 'suspended@example.test', '{}'),
  ('c9000000-0000-4000-8000-000000000006', 'mfa@example.test', '{}'),
  ('c9000000-0000-4000-8000-000000000007', 'leaver@example.test', '{"marketing_consent": true}'),
  ('c9000000-0000-4000-8000-000000000008', 'roi@example.test', '{"marketing_consent": true, "signup_source": "roi-calculator"}'),
  ('c9000000-0000-4000-8000-000000000010', 'no@example.test', '{"marketing_consent": "false", "signup_source": "<script>"}'),
  ('c9000000-0000-4000-8000-000000000011', 'paying2@example.test', '{}');
INSERT INTO public.profiles (id, email, full_name, trial_ends_at, is_active) VALUES
  ('c9000000-0000-4000-8000-000000000001', 'paying@example.test', 'Paying', null, true),
  ('c9000000-0000-4000-8000-000000000002', 'trial@example.test', 'Trial', now() + interval '5 days', true),
  ('c9000000-0000-4000-8000-000000000003', 'ended@example.test', 'Ended', now() - interval '3 days', true),
  ('c9000000-0000-4000-8000-000000000005', 'suspended@example.test', 'Suspended', null, false),
  ('c9000000-0000-4000-8000-000000000006', 'mfa@example.test', 'Mfa', now() - interval '3 days', true),
  ('c9000000-0000-4000-8000-000000000011', 'paying2@example.test', 'Paying Two', null, true);
INSERT INTO public.subscribers (user_id, email, subscribed, subscription_status, plan_key) VALUES
  ('c9000000-0000-4000-8000-000000000001', 'paying@example.test', true, 'active', 'starter'),
  ('c9000000-0000-4000-8000-000000000005', 'suspended@example.test', true, 'active', 'starter'),
  ('c9000000-0000-4000-8000-000000000011', 'paying2@example.test', true, 'active', 'starter');
INSERT INTO auth.mfa_factors (user_id, status) VALUES ('c9000000-0000-4000-8000-000000000006', 'verified');

-- The access states the tests rely on (production's _access_state_for).
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT string_agg(right(u::text, 2) || '=' || coalesce((SELECT s.state FROM public._access_state_for(u) s), 'none'), ' ' ORDER BY u)
                        FROM unnest(ARRAY['c9000000-0000-4000-8000-000000000001', 'c9000000-0000-4000-8000-000000000002', 'c9000000-0000-4000-8000-000000000003',
                                          'c9000000-0000-4000-8000-000000000004', 'c9000000-0000-4000-8000-000000000005']::uuid[]) u)
                     = '01=subscribed 02=trial 03=trial_ended 04=trial_ended 05=suspended', 'fixture: paying, trial, trial ended, no row (= trial ended), suspended');
END $$;

\echo '== apply'
\i docs/phase39/proposal.sql
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.free_tools_write_ok()', 'public.marketing_consent_set(boolean,text)', 'public.marketing_consent_record_signup()'] LOOP
    PERFORM pg_temp.ok((SELECT array_agg(x ORDER BY x) FROM unnest((SELECT proacl::text[] FROM pg_proc WHERE oid = f::regprocedure)) x)
      = ARRAY['authenticated=X/postgres','postgres=X/postgres'], f || ': authenticated only (not anon, not PUBLIC)');
    PERFORM pg_temp.ok((SELECT prosecdef AND proconfig @> ARRAY['search_path=""'] FROM pg_proc WHERE oid = f::regprocedure), f || ': SECURITY DEFINER, search_path pinned');
  END LOOP;
  PERFORM pg_temp.ok(NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public._free_tool_item_guard()'::regprocedure)
                     AND NOT has_function_privilege('authenticated', 'public._free_tool_item_guard()', 'EXECUTE')
                     AND NOT has_function_privilege('anon', 'public._free_tool_item_guard()', 'EXECUTE'), 'trigger function: not SECURITY DEFINER, not callable');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.phase25_mfa_guard_log g JOIN pg_proc p ON p.oid = to_regprocedure(g.fn)
                       WHERE g.fn IN ('public.free_tools_write_ok()', 'public.marketing_consent_set(boolean,text)', 'public.marketing_consent_record_signup()')
                         AND g.kind = 'user' AND md5(p.prosrc) = g.new_md5
                         AND md5(replace(p.prosrc, E'\n  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard', '')) = g.old_md5) = 3,
                     'guard log: 3 rows, new_md5 and old_md5 right');
  PERFORM pg_temp.ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.free_tool_items'::regclass)
                     AND (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.marketing_consents'::regclass), 'RLS on both tables');
  PERFORM pg_temp.ok((SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('free_tool_items', 'marketing_consents')
                       AND policyname = 'require_aal2_if_enrolled' AND permissive = 'RESTRICTIVE' AND cmd = 'ALL' AND roles = '{authenticated}') = 2,
                     'restrictive aal2 policy on both tables');
  PERFORM pg_temp.ok((SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'free_tool_items' AND permissive = 'RESTRICTIVE' AND policyname LIKE 'fti_write_%') = 3,
                     'restrictive write policies (insert, update, delete) on items');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('free_tool_items', 'marketing_consents') AND roles && '{anon,public}'),
                     'no policy for anon or public');
  PERFORM pg_temp.ok(NOT has_table_privilege('anon', 'public.free_tool_items', 'SELECT,INSERT,UPDATE,DELETE')
                     AND NOT has_table_privilege('anon', 'public.marketing_consents', 'SELECT,INSERT,UPDATE,DELETE')
                     AND has_table_privilege('authenticated', 'public.marketing_consents', 'SELECT')
                     AND NOT has_table_privilege('authenticated', 'public.marketing_consents', 'INSERT,UPDATE,DELETE'),
                     'grants: anon nothing; consents read-only for users (written through the functions)');
  PERFORM pg_temp.ok((SELECT confdeltype FROM pg_constraint WHERE conrelid = 'public.free_tool_items'::regclass AND contype = 'f') = 'c'
                     AND (SELECT confdeltype FROM pg_constraint WHERE conrelid = 'public.marketing_consents'::regclass AND contype = 'f') = 'c'
                     AND (SELECT confrelid FROM pg_constraint WHERE conrelid = 'public.free_tool_items'::regclass AND contype = 'f') = 'auth.users'::regclass,
                     'both reference auth.users ON DELETE CASCADE');
END $$;

CREATE FUNCTION pg_temp.who(n int, aal text DEFAULT 'aal1') RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', 'c9000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'), 'role', 'authenticated', 'aal', aal)::text, false) $$;
CREATE FUNCTION pg_temp.u(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('c9000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid $$;
GRANT EXECUTE ON FUNCTION pg_temp.who(int, text), pg_temp.u(int) TO PUBLIC;
-- An item the suspended account saved before it was suspended.
INSERT INTO public.free_tool_items (user_id, tool, name, data) VALUES (pg_temp.u(5), 'goal-tracker', 'Before suspension', '{"goals":[]}');

\echo '== free tier: trial ended and no plan can save'
SELECT pg_temp.who(3); SET ROLE authenticated;
DO $$ DECLARE r public.free_tool_items; BEGIN
  INSERT INTO public.free_tool_items (user_id, tool, name, data, created_at, updated_at)
  VALUES (pg_temp.u(3), 'roi-calculator', '  New van  ', '{"investment":"12000"}', now() - interval '1 year', now() - interval '1 year') RETURNING * INTO r;
  PERFORM pg_temp.ok(r.name = 'New van' AND r.created_at > now() - interval '1 minute' AND r.updated_at > now() - interval '1 minute',
                     'trial ended: saves; name trimmed; created_at / updated_at from the server clock');
  PERFORM pg_temp.ok(public.free_tools_write_ok(), 'trial ended: free_tools_write_ok true');
  UPDATE public.free_tool_items SET name = 'New van (2)', data = '{"investment":"13000"}' WHERE id = r.id;
  DELETE FROM public.free_tool_items WHERE id = r.id;
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.free_tool_items WHERE id = r.id), 'trial ended: edits and deletes own items');
  INSERT INTO public.free_tool_items (user_id, tool, name, data) VALUES (pg_temp.u(3), 'setup-checklist', 'My checklist', '["bank","hmrc"]');
END $$;
RESET ROLE;
SELECT pg_temp.who(4); SET ROLE authenticated;
DO $$ BEGIN
  INSERT INTO public.free_tool_items (user_id, tool, name, data) VALUES (pg_temp.u(4), 'compliance', 'My result', '{"structure":"sole-trader"}');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.free_tool_items) = 1, 'no profile, no plan: saves and sees only its own item');
END $$;
RESET ROLE;
SELECT pg_temp.who(2); SET ROLE authenticated;
DO $$ BEGIN
  INSERT INTO public.free_tool_items (user_id, tool, name, data) VALUES (pg_temp.u(2), 'cost-calculator', 'Ltd costs', '{"structure":"ltd"}');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.free_tool_items) = 1, 'trial: saves');
END $$;
RESET ROLE;

\echo '== paying: own rows only; other people''s rows are invisible and untouchable'
SELECT pg_temp.who(1); SET ROLE authenticated;
DO $$ DECLARE n int; BEGIN
  INSERT INTO public.free_tool_items (user_id, tool, name, data) VALUES (pg_temp.u(1), 'customer-survey-builder', 'Survey', '{"questions":[]}');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.free_tool_items) = 1 AND (SELECT user_id FROM public.free_tool_items) = pg_temp.u(1), 'paying: saves; sees only its own');
  UPDATE public.free_tool_items SET name = 'stolen' WHERE user_id = pg_temp.u(3); GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.ok(n = 0, 'another user''s item: update touches nothing');
  DELETE FROM public.free_tool_items WHERE user_id <> pg_temp.u(1); GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.ok(n = 0, 'another user''s item: delete touches nothing');
END $$;
SELECT pg_temp.fails($$INSERT INTO public.free_tool_items (user_id, tool, name) VALUES (pg_temp.u(3), 'goal-tracker', 'Planted')$$, 'row-level security', 'cannot save an item as someone else');
SELECT pg_temp.fails($$UPDATE public.free_tool_items SET user_id = pg_temp.u(3) WHERE user_id = pg_temp.u(1)$$, 'FREE_TOOL_ITEM_FIXED', 'cannot hand an item to someone else');
SELECT pg_temp.fails($$UPDATE public.free_tool_items SET tool = 'goal-tracker' WHERE user_id = pg_temp.u(1)$$, 'FREE_TOOL_ITEM_FIXED', 'an item stays in its tool');
SELECT pg_temp.fails($$INSERT INTO public.free_tool_items (user_id, tool, name) VALUES (pg_temp.u(1), 'business-finance-assistant', 'x')$$, 'fti_tool', 'tool CHECK: a paid tool is refused');
SELECT pg_temp.fails($$INSERT INTO public.free_tool_items (user_id, tool, name) VALUES (pg_temp.u(1), 'notepro', 'x')$$, 'fti_tool', 'tool CHECK: other free tools (NotePro) are refused');
SELECT pg_temp.fails($$INSERT INTO public.free_tool_items (user_id, tool, name) VALUES (pg_temp.u(1), 'goal-tracker', repeat('a', 121))$$, 'fti_name', 'name over 120 characters refused');
SELECT pg_temp.fails($$INSERT INTO public.free_tool_items (user_id, tool, name) VALUES (pg_temp.u(1), 'goal-tracker', '   ')$$, 'fti_name', 'blank name refused');
SELECT pg_temp.fails($$INSERT INTO public.free_tool_items (user_id, tool, name, data) VALUES (pg_temp.u(1), 'goal-tracker', 'x', '"text"')$$, 'fti_data', 'data must be an object or a list');
SELECT pg_temp.fails($$INSERT INTO public.free_tool_items (user_id, tool, name, data)
  VALUES (pg_temp.u(1), 'goal-tracker', 'Big', jsonb_build_object('notes', (SELECT string_agg(md5(i::text), '') FROM generate_series(1, 2100) i)))$$, 'fti_data', 'data over 64 KB refused');
DO $$ BEGIN
  INSERT INTO public.free_tool_items (user_id, tool, name, data)
  VALUES (pg_temp.u(1), 'goal-tracker', 'Nearly 64 KB', jsonb_build_object('notes', (SELECT string_agg(md5(i::text), '') FROM generate_series(1, 1900) i)));
  PERFORM pg_temp.ok((SELECT pg_column_size(data) FROM public.free_tool_items WHERE name = 'Nearly 64 KB') BETWEEN 60000 AND 65536, 'data just under 64 KB saves');
END $$;

\echo '== 50 items per user per tool'
DO $$ BEGIN
  INSERT INTO public.free_tool_items (user_id, tool, name, data) SELECT pg_temp.u(1), 'roi-calculator', 'Scenario ' || i, '{}' FROM generate_series(1, 50) i;
  PERFORM pg_temp.ok((SELECT count(*) FROM public.free_tool_items WHERE tool = 'roi-calculator') = 50, '50 ROI items saved');
END $$;
SELECT pg_temp.fails($$INSERT INTO public.free_tool_items (user_id, tool, name) VALUES (pg_temp.u(1), 'roi-calculator', 'Scenario 51')$$, 'FREE_TOOL_ITEM_LIMIT', 'the 51st item in one tool is refused');
DO $$ BEGIN
  INSERT INTO public.free_tool_items (user_id, tool, name) VALUES (pg_temp.u(1), 'setup-checklist', 'Other tool');
  PERFORM pg_temp.ok(true, 'the limit is per tool: another tool still saves');
  DELETE FROM public.free_tool_items WHERE id = (SELECT id FROM public.free_tool_items WHERE tool = 'roi-calculator' LIMIT 1);
  INSERT INTO public.free_tool_items (user_id, tool, name) VALUES (pg_temp.u(1), 'roi-calculator', 'After deleting one');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.free_tool_items WHERE tool = 'roi-calculator') = 50, 'after deleting one, saving works again (50)');
END $$;
RESET ROLE;
SELECT pg_temp.who(11); SET ROLE authenticated;
DO $$ BEGIN
  INSERT INTO public.free_tool_items (user_id, tool, name) VALUES (pg_temp.u(11), 'roi-calculator', 'Mine');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.free_tool_items) = 1, 'the limit is per user: another user saves ROI items; still sees only its own');
END $$;
RESET ROLE;

\echo '== suspended: read only'
SELECT pg_temp.who(5); SET ROLE authenticated;
DO $$ DECLARE n int; BEGIN
  PERFORM pg_temp.ok((SELECT count(*) FROM public.free_tool_items) = 1 AND (SELECT name FROM public.free_tool_items) = 'Before suspension', 'suspended: still reads its own items');
  PERFORM pg_temp.ok(NOT public.free_tools_write_ok(), 'suspended: free_tools_write_ok false');
  UPDATE public.free_tool_items SET name = 'changed'; GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.ok(n = 0, 'suspended: update changes nothing');
  DELETE FROM public.free_tool_items; GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.ok(n = 0 AND (SELECT count(*) FROM public.free_tool_items) = 1, 'suspended: delete removes nothing');
END $$;
SELECT pg_temp.fails($$INSERT INTO public.free_tool_items (user_id, tool, name) VALUES (pg_temp.u(5), 'goal-tracker', 'New')$$, 'row-level security', 'suspended: cannot save');
RESET ROLE;

\echo '== two-step verification (restrictive aal2 policy)'
INSERT INTO public.free_tool_items (user_id, tool, name) VALUES (pg_temp.u(6), 'goal-tracker', 'Saved with the code');
SELECT pg_temp.who(6, 'aal1'); SET ROLE authenticated;
DO $$ BEGIN PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.free_tool_items), 'two-step set up, code not entered: nothing readable'); END $$;
SELECT pg_temp.fails($$INSERT INTO public.free_tool_items (user_id, tool, name) VALUES (pg_temp.u(6), 'goal-tracker', 'x')$$, 'MFA_REQUIRED', 'two-step set up, code not entered: cannot save');
SELECT pg_temp.fails($$SELECT public.marketing_consent_set(true)$$, 'MFA_REQUIRED', 'two-step set up, code not entered: consent refused');
RESET ROLE;
SELECT pg_temp.who(6, 'aal2'); SET ROLE authenticated;
DO $$ BEGIN
  INSERT INTO public.free_tool_items (user_id, tool, name) VALUES (pg_temp.u(6), 'goal-tracker', 'x');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.free_tool_items) = 2, 'with the code (aal2): reads and saves');
END $$;
RESET ROLE; RESET request.jwt.claims;

\echo '== anon'
SET ROLE anon;
SELECT pg_temp.fails($$SELECT * FROM public.free_tool_items$$, 'permission denied', 'anon: cannot read items');
SELECT pg_temp.fails($$INSERT INTO public.free_tool_items (user_id, tool, name) VALUES (gen_random_uuid(), 'goal-tracker', 'x')$$, 'permission denied', 'anon: cannot save items');
SELECT pg_temp.fails($$DELETE FROM public.free_tool_items$$, 'permission denied', 'anon: cannot delete items');
SELECT pg_temp.fails($$SELECT * FROM public.marketing_consents$$, 'permission denied', 'anon: cannot read consents');
SELECT pg_temp.fails($$SELECT public.marketing_consent_set(true)$$, 'permission denied', 'anon: cannot set consent');
SELECT pg_temp.fails($$SELECT public.marketing_consent_record_signup()$$, 'permission denied', 'anon: cannot record sign-up consent');
SELECT pg_temp.fails($$SELECT public.free_tools_write_ok()$$, 'permission denied', 'anon: cannot call free_tools_write_ok');
RESET ROLE;

\echo '== marketing consent'
SELECT pg_temp.who(8); SET ROLE authenticated;
DO $$ DECLARE j json; BEGIN
  j := public.marketing_consent_record_signup();
  PERFORM pg_temp.ok((j ->> 'recorded')::boolean AND (j ->> 'consented')::boolean AND j ->> 'source' = 'roi-calculator', 'sign-up from the ROI Calculator, box ticked: recorded yes, source roi-calculator');
  PERFORM pg_temp.ok((SELECT consented AND source = 'roi-calculator' AND consent_text_version = 'v1' AND consented_at > now() - interval '1 minute' FROM public.marketing_consents),
                     'row: yes, wording v1, consented_at from the server clock');
  j := public.marketing_consent_record_signup();
  PERFORM pg_temp.ok(NOT (j ->> 'recorded')::boolean AND j ->> 'reason' = 'already_recorded', 'recorded once only');
  j := public.marketing_consent_set(false);
  PERFORM pg_temp.ok((SELECT NOT consented AND consented_at IS NOT NULL AND source = 'roi-calculator' FROM public.marketing_consents),
                     'withdrawn in Settings: no; when they had agreed is kept; first source kept');
  j := public.marketing_consent_record_signup();
  PERFORM pg_temp.ok(NOT (SELECT consented FROM public.marketing_consents), 'a later sign-in never overrides a withdrawal');
END $$;
SELECT pg_temp.fails($$INSERT INTO public.marketing_consents (user_id, consented, source, consent_text_version) VALUES (pg_temp.u(8), true, 'signup', 'v1')$$, 'permission denied', 'no direct insert');
SELECT pg_temp.fails($$UPDATE public.marketing_consents SET consented = true, consented_at = now() - interval '1 year'$$, 'permission denied', 'no direct update (no backdating)');
SELECT pg_temp.fails($$DELETE FROM public.marketing_consents$$, 'permission denied', 'no direct delete');
SELECT pg_temp.fails($$SELECT public.marketing_consent_set(true, 'somewhere-else')$$, 'mc_source', 'an unknown source is refused');
SELECT pg_temp.fails($$SELECT public.marketing_consent_set(null)$$, 'CONSENT_REQUIRED', 'a missing choice is refused');
RESET ROLE;
SELECT pg_temp.who(10); SET ROLE authenticated;
DO $$ DECLARE j json; BEGIN
  j := public.marketing_consent_record_signup();
  PERFORM pg_temp.ok((j ->> 'recorded')::boolean AND NOT (j ->> 'consented')::boolean AND j ->> 'source' = 'signup', 'box not ticked: recorded no; an unknown source becomes signup');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.marketing_consents) = 1 AND (SELECT consented_at IS NULL FROM public.marketing_consents), 'sees only its own row; never agreed, so no consented_at');
END $$;
RESET ROLE;
SELECT pg_temp.who(1); SET ROLE authenticated;
DO $$ DECLARE j json; BEGIN
  j := public.marketing_consent_record_signup();
  PERFORM pg_temp.ok(NOT (j ->> 'recorded')::boolean AND j ->> 'reason' = 'no_choice' AND NOT EXISTS (SELECT 1 FROM public.marketing_consents), 'older account with no sign-up choice: nothing recorded, other rows invisible');
  j := public.marketing_consent_set(true, 'settings');
  PERFORM pg_temp.ok((j ->> 'consented')::boolean AND j ->> 'source' = 'settings' AND (SELECT count(*) FROM public.marketing_consents) = 1, 'switched on in Settings: yes, source settings');
END $$;
RESET ROLE;
SELECT pg_temp.who(5); SET ROLE authenticated;
DO $$ BEGIN
  PERFORM public.marketing_consent_set(false);
  PERFORM pg_temp.ok((SELECT NOT consented FROM public.marketing_consents), 'suspended: can still say no');
END $$;
RESET ROLE; RESET request.jwt.claims;
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT string_agg(right(user_id::text, 2) || '=' || consented, ' ' ORDER BY user_id) FROM public.marketing_consents) = '01=true 05=false 08=false 10=false',
                     'each consent row changed only by its owner');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.marketing_consents WHERE consented) = 1, 'export: only consented = true (one person) may be emailed');
END $$;

\echo '== deleting an account removes its items and consent'
SELECT pg_temp.who(7); SET ROLE authenticated;
DO $$ BEGIN
  INSERT INTO public.free_tool_items (user_id, tool, name) VALUES (pg_temp.u(7), 'best-practices', 'Leaving');
  PERFORM public.marketing_consent_record_signup();
END $$;
RESET ROLE; RESET request.jwt.claims;
DO $$ DECLARE before int := (SELECT count(*) FROM public.free_tool_items); BEGIN
  PERFORM pg_temp.ok(EXISTS (SELECT 1 FROM public.marketing_consents WHERE user_id = pg_temp.u(7) AND consented), 'leaver: consent recorded');
  DELETE FROM auth.users WHERE id = pg_temp.u(7);
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.free_tool_items WHERE user_id = pg_temp.u(7)) AND NOT EXISTS (SELECT 1 FROM public.marketing_consents WHERE user_id = pg_temp.u(7))
                     AND (SELECT count(*) FROM public.free_tool_items) = before - 1, 'cascade: the leaver''s item and consent are gone, nothing else');
END $$;
