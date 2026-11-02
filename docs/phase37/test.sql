-- Phase 37 tests (DISPOSABLE local Postgres only). Run by docs/phase37/run-test.sh after the shim, the Phase 35 / 36 fixtures
-- and proposals (production credit functions, hash-checked) and docs/phase37/fixture.sql.
\set ON_ERROR_STOP 1
\i docs/phase37/test-helpers.sql

-- People. 1 subscriber (buyer), 2 trial, 3 trial ended (no row), 4 company member of 1, 5 suspended subscriber,
-- 6 master account (no subscription), 7 second subscriber (cap), 9 super admin.
INSERT INTO auth.users (id, email) VALUES
  ('d0000000-0000-4000-8000-000000000001', 'sub@example.test'),
  ('d0000000-0000-4000-8000-000000000002', 'trial@example.test'),
  ('d0000000-0000-4000-8000-000000000003', 'ended@example.test'),
  ('d0000000-0000-4000-8000-000000000004', 'member@example.test'),
  ('d0000000-0000-4000-8000-000000000005', 'suspended@example.test'),
  ('d0000000-0000-4000-8000-000000000006', 'master@example.test'),
  ('d0000000-0000-4000-8000-000000000007', 'sub2@example.test'),
  ('d0000000-0000-4000-8000-000000000009', 'super@example.test');
INSERT INTO public.profiles (id, email, full_name, trial_ends_at, is_active) VALUES
  ('d0000000-0000-4000-8000-000000000001', 'sub@example.test', 'Sub', null, true),
  ('d0000000-0000-4000-8000-000000000002', 'trial@example.test', 'Trial', now() + interval '5 days', true),
  ('d0000000-0000-4000-8000-000000000003', 'ended@example.test', 'Ended', now() - interval '1 day', true),
  ('d0000000-0000-4000-8000-000000000004', 'member@example.test', 'Member', null, true),
  ('d0000000-0000-4000-8000-000000000005', 'suspended@example.test', 'Suspended', null, false),
  ('d0000000-0000-4000-8000-000000000006', 'master@example.test', 'Master', null, true),
  ('d0000000-0000-4000-8000-000000000007', 'sub2@example.test', 'Sub Two', null, true),
  ('d0000000-0000-4000-8000-000000000009', 'super@example.test', 'Super', null, true);
INSERT INTO public.user_roles (user_id, role) VALUES ('d0000000-0000-4000-8000-000000000009', 'super_admin');
INSERT INTO public.master_access (user_id, note) VALUES ('d0000000-0000-4000-8000-000000000006', 'testing');
INSERT INTO public.subscribers (user_id, email, subscribed, subscription_status, subscription_tier, plan_key, ai_credits_limit, ai_credits_remaining) VALUES
  ('d0000000-0000-4000-8000-000000000001', 'sub@example.test', true, 'active', 'Starter', 'starter', 250, 20),
  ('d0000000-0000-4000-8000-000000000005', 'suspended@example.test', true, 'active', 'Starter', 'starter', 250, 250),
  ('d0000000-0000-4000-8000-000000000007', 'sub2@example.test', true, 'active', 'Starter', 'starter', 250, 250);
INSERT INTO public.organization_billing (organization_id, billing_user_id) VALUES ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001');
INSERT INTO public.organization_members (organization_id, user_id, role) VALUES ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000004', 'member');

\echo '== apply'
CREATE TEMP TABLE t_before AS SELECT count(*) AS reserves FROM public.ai_credit_ledger WHERE event = 'reserve';
\i docs/phase37/proposal.sql
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.begin_ai_topup_checkout(uuid,text)', 'public.attach_ai_topup_session(uuid,text)',
                           'public.grant_ai_topup(uuid,text,text,text,integer)', 'public.void_ai_topup(text,text,text)'] LOOP
    PERFORM pg_temp.ok((SELECT array_agg(x ORDER BY x) FROM unnest((SELECT proacl::text[] FROM pg_proc WHERE oid = f::regprocedure)) x)
      = ARRAY['postgres=X/postgres','service_role=X/postgres'], f || ': service role (and postgres) only');
    PERFORM pg_temp.ok((SELECT prosecdef AND proconfig @> ARRAY['search_path=""'] FROM pg_proc WHERE oid = f::regprocedure), f || ': SECURITY DEFINER, search_path pinned');
  END LOOP;
  PERFORM pg_temp.ok((SELECT array_agg(x ORDER BY x) FROM unnest((SELECT proacl::text[] FROM pg_proc WHERE oid = 'public.admin_ai_topup_summary(integer)'::regprocedure)) x)
    = ARRAY['authenticated=X/postgres','postgres=X/postgres','service_role=X/postgres'], 'admin summary: authenticated (guarded), service role; not anon');
  PERFORM pg_temp.ok(NOT has_function_privilege('authenticated', 'public._ai_topup_balance(uuid)', 'EXECUTE')
                     AND NOT has_function_privilege('anon', 'public._ai_topup_balance(uuid)', 'EXECUTE'), 'balance helper: not for anon / authenticated');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.phase37_function_backup b JOIN pg_proc p ON p.oid = to_regprocedure('public.' || b.fn)
                       WHERE (SELECT array_agg(x ORDER BY x) FROM unnest(p.proacl::text[]) x) = (SELECT array_agg(x ORDER BY x) FROM unnest(b.acl::text[]) x)) = 3,
                     'the three replaced functions keep their privileges');
  -- Phase 25 guard log: every guarded function's row matches its body, and stripping the line gives old_md5.
  PERFORM pg_temp.ok((SELECT count(*) FROM public.phase25_mfa_guard_log g JOIN pg_proc p ON p.oid = to_regprocedure(g.fn)
                       WHERE g.fn ~ 'topup|check_and_deduct|get_ai_credits_info' AND md5(p.prosrc) = g.new_md5
                         AND md5(replace(p.prosrc, CASE g.kind WHEN 'admin' THEN E'\n  PERFORM public.require_aal2_admin(); -- phase25 mfa guard'
                                                              ELSE E'\n  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard' END, '')) = g.old_md5) = 7,
                     'guard log: 7 rows (5 new, 2 updated), new_md5 and old_md5 right');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.ai_topup_packs) = 3
                     AND (SELECT string_agg(id || ':' || credits || ':' || amount_pence, ' ' ORDER BY credits) FROM public.ai_topup_packs)
                         = 'credits_100:100:500 credits_300:300:1200 credits_1000:1000:3500', 'catalogue: 100 £5, 300 £12, 1,000 £35');
  PERFORM pg_temp.ok(NOT has_table_privilege('anon', 'public.ai_credit_lots', 'SELECT') AND NOT has_table_privilege('authenticated', 'public.ai_credit_lots', 'INSERT')
                     AND NOT has_table_privilege('authenticated', 'public.ai_credit_lots', 'UPDATE') AND NOT has_table_privilege('authenticated', 'public.ai_topup_checkouts', 'SELECT')
                     AND NOT has_table_privilege('authenticated', 'public.ai_topup_packs', 'SELECT') AND has_table_privilege('authenticated', 'public.ai_credit_lots', 'SELECT'),
                     'tables: users may only SELECT lots (RLS); no writes; anon nothing');
  PERFORM pg_temp.ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.ai_credit_lots'::regclass)
                     AND (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.ai_topup_checkouts'::regclass)
                     AND (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.ai_topup_packs'::regclass), 'RLS on all three tables');
END $$;

\echo '== who may start a checkout (service role, as create-ai-topup-checkout calls it)'
SET request.jwt.claims = '{"role":"service_role"}';
SET ROLE service_role;
DO $$
DECLARE j json;
BEGIN
  j := public.begin_ai_topup_checkout('d0000000-0000-4000-8000-000000000002', 'credits_100');
  PERFORM pg_temp.ok(j ->> 'error' = 'not_subscriber' AND j ->> 'state' = 'trial', 'trial: refused (not_subscriber, state trial)');
  j := public.begin_ai_topup_checkout('d0000000-0000-4000-8000-000000000003', 'credits_100');
  PERFORM pg_temp.ok(j ->> 'error' = 'not_subscriber' AND j ->> 'state' = 'trial_ended', 'trial ended, no subscribers row: refused');
  j := public.begin_ai_topup_checkout('d0000000-0000-4000-8000-000000000004', 'credits_100');
  PERFORM pg_temp.ok(j ->> 'error' = 'not_subscriber' AND j ->> 'state' = 'subscribed' AND j ->> 'via' = 'company', 'company member (company pays): refused');
  j := public.begin_ai_topup_checkout('d0000000-0000-4000-8000-000000000005', 'credits_100');
  PERFORM pg_temp.ok(j ->> 'error' = 'not_subscriber' AND j ->> 'state' = 'suspended', 'suspended subscriber: refused');
  j := public.begin_ai_topup_checkout('d0000000-0000-4000-8000-000000000001', 'credits_999');
  PERFORM pg_temp.ok(j ->> 'error' = 'unknown_pack', 'unknown pack: refused');
  j := public.begin_ai_topup_checkout('d0000000-0000-4000-8000-000000000001', 'credits_300');
  PERFORM pg_temp.ok((j ->> 'success')::boolean AND (j ->> 'credits')::int = 300 AND (j ->> 'amount_pence')::int = 1200 AND j ->> 'currency' = 'gbp',
                     'own subscriber: allowed; credits and price from the catalogue');
  j := public.begin_ai_topup_checkout('d0000000-0000-4000-8000-000000000001', 'credits_100');
  PERFORM pg_temp.ok(j ->> 'error' = 'rate_limited', 'a second checkout within a minute: rate_limited');
  j := public.begin_ai_topup_checkout('d0000000-0000-4000-8000-000000000006', 'credits_100');
  PERFORM pg_temp.ok((j ->> 'success')::boolean, 'master account (testing): allowed');
  j := public.begin_ai_topup_checkout('d0000000-0000-4000-8000-000000000009', 'credits_100');
  PERFORM pg_temp.ok((j ->> 'success')::boolean, 'super admin / owner (testing): allowed');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.ai_topup_checkouts) = 3, 'only allowed checkouts were recorded');
END $$;

\echo '== attach the Stripe session'
DO $$
DECLARE c uuid; j json;
BEGIN
  SELECT id INTO c FROM public.ai_topup_checkouts WHERE user_id = 'd0000000-0000-4000-8000-000000000001';
  j := public.attach_ai_topup_session(c, 'cs_test_sub_300');
  PERFORM pg_temp.ok((j ->> 'success')::boolean, 'attach: session id stored');
  j := public.attach_ai_topup_session(c, 'cs_test_other');
  PERFORM pg_temp.ok(NOT (j ->> 'success')::boolean AND (SELECT stripe_checkout_session_id FROM public.ai_topup_checkouts WHERE id = c) = 'cs_test_sub_300',
                     'attach: a second attach changes nothing');
  SELECT id INTO c FROM public.ai_topup_checkouts WHERE user_id = 'd0000000-0000-4000-8000-000000000009';
  j := public.attach_ai_topup_session(c, NULL);
  PERFORM pg_temp.ok((SELECT status FROM public.ai_topup_checkouts WHERE id = c) = 'failed', 'attach NULL (Stripe failed): checkout closed, not counted');
END $$;

\echo '== grant (only from the webhook, after payment)'
DO $$
DECLARE j json; k json;
BEGIN
  j := public.grant_ai_topup('d0000000-0000-4000-8000-000000000001', 'credits_300', 'cs_test_sub_300', 'pi_test_sub_300', 1200);
  PERFORM pg_temp.ok((j ->> 'success')::boolean AND (j ->> 'granted')::int = 300 AND NOT (j ->> 'duplicate')::boolean, 'grant: 300 credits');
  PERFORM pg_temp.ok((SELECT expires_at::date FROM public.ai_credit_lots WHERE stripe_checkout_session_id = 'cs_test_sub_300') = (now() + interval '12 months')::date,
                     'grant: lot lasts 12 months');
  PERFORM pg_temp.ok((SELECT status FROM public.ai_topup_checkouts WHERE stripe_checkout_session_id = 'cs_test_sub_300') = 'paid', 'grant: checkout marked paid');
  k := public.grant_ai_topup('d0000000-0000-4000-8000-000000000001', 'credits_300', 'cs_test_sub_300', 'pi_test_sub_300', 1200);
  PERFORM pg_temp.ok((k ->> 'duplicate')::boolean AND (k ->> 'granted')::int = 0 AND k ->> 'lot_id' = j ->> 'lot_id', 'grant: repeat delivery grants nothing, same lot');
  k := public.grant_ai_topup('d0000000-0000-4000-8000-000000000007', 'credits_300', 'cs_test_sub_300', 'pi_test_sub_300', 1200);
  PERFORM pg_temp.ok(k ->> 'error' = 'session_user_mismatch', 'grant: same session for another user refused');
  k := public.grant_ai_topup('d0000000-0000-4000-8000-000000000001', 'credits_300', 'cs_test_cheap', 'pi_test_cheap', 500);
  PERFORM pg_temp.ok(k ->> 'error' = 'amount_mismatch' AND NOT EXISTS (SELECT 1 FROM public.ai_credit_lots WHERE stripe_checkout_session_id = 'cs_test_cheap'),
                     'grant: amount different from the pack price refused, nothing granted');
  k := public.grant_ai_topup('d0000000-0000-4000-8000-000000000001', 'credits_9', 'cs_test_bad', 'pi_test_bad', 500);
  PERFORM pg_temp.ok(k ->> 'error' = 'unknown_pack', 'grant: unknown pack refused');
  k := public.grant_ai_topup('d0000000-0000-4000-8000-000000000001', 'credits_100', 'not_a_session', 'pi_x', 500);
  PERFORM pg_temp.ok(k ->> 'error' = 'invalid_request', 'grant: malformed session id refused');
  k := public.grant_ai_topup('f0000000-0000-4000-8000-000000000000', 'credits_100', 'cs_test_ghost', 'pi_test_ghost', 500);
  PERFORM pg_temp.ok(k ->> 'error' = 'unknown_user', 'grant: unknown user refused (manual refund)');
  -- Two more lots for the spending order: one bought later (expires later) and one already expired.
  j := public.grant_ai_topup('d0000000-0000-4000-8000-000000000001', 'credits_100', 'cs_test_sub_100', 'pi_test_sub_100', 500);
  j := public.grant_ai_topup('d0000000-0000-4000-8000-000000000001', 'credits_100', 'cs_test_sub_old', 'pi_test_sub_old', 500);
  PERFORM pg_temp.ok((SELECT count(*) FROM public.ai_credit_ledger WHERE event = 'topup' AND user_id = 'd0000000-0000-4000-8000-000000000001') = 3,
                     'ledger: one topup row per grant (none for refusals or repeats)');
END $$;
RESET ROLE; RESET request.jwt.claims;
-- (postgres) the 300 lot expires sooner than the 100 lot; the "old" lot has expired.
UPDATE public.ai_credit_lots SET expires_at = now() + interval '1 month' WHERE stripe_checkout_session_id = 'cs_test_sub_300';
UPDATE public.ai_credit_lots SET expires_at = now() - interval '1 day', purchased_at = now() - interval '13 months' WHERE stripe_checkout_session_id = 'cs_test_sub_old';

\echo '== spending: monthly first, then lots by soonest expiry; all or nothing'
SET request.jwt.claims = '{"role":"service_role"}';
SET ROLE service_role;
DO $$
DECLARE j json; r record;
  u constant uuid := 'd0000000-0000-4000-8000-000000000001';
  l300 uuid := (SELECT id FROM public.ai_credit_lots WHERE stripe_checkout_session_id = 'cs_test_sub_300');
  l100 uuid := (SELECT id FROM public.ai_credit_lots WHERE stripe_checkout_session_id = 'cs_test_sub_100');
BEGIN
  j := public.get_ai_credits_info(u);
  PERFORM pg_temp.ok((j ->> 'monthly_remaining')::int = 20 AND (j ->> 'topup_credits')::int = 400 AND (j ->> 'credits_remaining')::int = 420,
                     'info: 20 monthly + 400 top-up (the expired lot is ignored)');
  PERFORM pg_temp.ok((j ->> 'topup_next_expiry')::timestamptz = (SELECT expires_at FROM public.ai_credit_lots WHERE id = l300), 'info: next expiry is the soonest lot');

  j := public.check_and_deduct_ai_credit(u, 30, 'legal_document', 'c7000000-0000-4000-8000-000000000001');
  PERFORM pg_temp.ok((j ->> 'success')::boolean AND (j ->> 'monthly_remaining')::int = 0 AND (j ->> 'topup_credits')::int = 390 AND (j ->> 'credits_remaining')::int = 390,
                     '30 credits: 20 monthly, then 10 top-up');
  PERFORM pg_temp.ok((SELECT credits_remaining FROM public.ai_credit_lots WHERE id = l300) = 290 AND (SELECT credits_remaining FROM public.ai_credit_lots WHERE id = l100) = 100,
                     'the soonest-expiring lot is used first');
  SELECT * INTO r FROM public.ai_credit_ledger WHERE request_id = 'c7000000-0000-4000-8000-000000000001' AND event = 'reserve';
  PERFORM pg_temp.ok(r.credits = -30 AND r.topup_credits = 10 AND r.topup_lots = jsonb_build_array(jsonb_build_object('lot', l300, 'credits', 10)) AND r.balance_after = 390,
                     'ledger split: one reserve row, -30, of which 10 from the 300 lot');

  j := public.check_and_deduct_ai_credit(u, 1000, 'legal_document', 'c7000000-0000-4000-8000-000000000009');
  PERFORM pg_temp.ok(NOT (j ->> 'success')::boolean AND j ->> 'error' = 'insufficient_credits' AND (j ->> 'credits_remaining')::int = 390
                     AND (j ->> 'monthly_remaining')::int = 0 AND (j ->> 'topup_credits')::int = 390, 'not enough in total: refused with monthly + top-up');
  PERFORM pg_temp.ok((SELECT credits_remaining FROM public.ai_credit_lots WHERE id = l300) = 290 AND (SELECT credits_remaining FROM public.ai_credit_lots WHERE id = l100) = 100
                     AND NOT EXISTS (SELECT 1 FROM public.ai_credit_ledger WHERE request_id = 'c7000000-0000-4000-8000-000000000009'),
                     'all or nothing: a refused request takes nothing and writes nothing');

  j := public.check_and_deduct_ai_credit(u, 295, 'legal_document', 'c7000000-0000-4000-8000-000000000002');
  PERFORM pg_temp.ok((j ->> 'topup_credits')::int = 95 AND (SELECT credits_remaining FROM public.ai_credit_lots WHERE id = l300) = 0
                     AND (SELECT credits_remaining FROM public.ai_credit_lots WHERE id = l100) = 95, '295 credits across two lots, soonest first');
  PERFORM pg_temp.ok((SELECT topup_lots FROM public.ai_credit_ledger WHERE request_id = 'c7000000-0000-4000-8000-000000000002' AND event = 'reserve')
                     = jsonb_build_array(jsonb_build_object('lot', l300, 'credits', 290), jsonb_build_object('lot', l100, 'credits', 5)), 'ledger split names both lots');

  -- Refunds go back where they came from, idempotently.
  j := public.refund_ai_credit(u, 295, 'legal_document', 'c7000000-0000-4000-8000-000000000002');
  PERFORM pg_temp.ok((j ->> 'refunded')::int = 295 AND (SELECT credits_remaining FROM public.ai_credit_lots WHERE id = l300) = 290
                     AND (SELECT credits_remaining FROM public.ai_credit_lots WHERE id = l100) = 100 AND (j ->> 'monthly_remaining')::int = 0,
                     'refund: back to the same lots, monthly untouched');
  j := public.refund_ai_credit(u, 295, 'legal_document', 'c7000000-0000-4000-8000-000000000002');
  PERFORM pg_temp.ok((j ->> 'refunded')::int = 0 AND (SELECT credits_remaining FROM public.ai_credit_lots WHERE id = l300) = 290, 'refund: a retry gives nothing back');
  j := public.refund_ai_credit(u, 30, 'legal_document', 'c7000000-0000-4000-8000-000000000001');
  PERFORM pg_temp.ok((j ->> 'refunded')::int = 30 AND (j ->> 'monthly_remaining')::int = 20 AND (SELECT credits_remaining FROM public.ai_credit_lots WHERE id = l300) = 300,
                     'refund of a mixed request: 10 to the lot, 20 to monthly');
  PERFORM pg_temp.ok((SELECT credits = 30 AND topup_credits = 10 FROM public.ai_credit_ledger WHERE request_id = 'c7000000-0000-4000-8000-000000000001' AND event = 'refund'),
                     'refund row records the split');
  j := public.refund_ai_credit(u, 500, 'legal_document', 'c7000000-0000-4000-8000-000000000003');
  PERFORM pg_temp.ok((j ->> 'monthly_remaining')::int = 250 AND (SELECT sum(credits_remaining) FROM public.ai_credit_lots WHERE user_id = u AND expires_at > now()) = 400,
                     'refund without a reserve row (older callers): monthly only, never above the limit, lots untouched');
END $$;
RESET ROLE; RESET request.jwt.claims;
UPDATE public.subscribers SET ai_credits_remaining = 20 WHERE user_id = 'd0000000-0000-4000-8000-000000000001';

SET request.jwt.claims = '{"role":"service_role"}';
SET ROLE service_role;
SELECT public.check_and_deduct_ai_credit('d0000000-0000-4000-8000-000000000001', 25, 'legal_document', 'c7000000-0000-4000-8000-000000000004');
RESET ROLE; RESET request.jwt.claims;
-- The 300 lot expires between the spend and the refund.
UPDATE public.ai_credit_lots SET expires_at = now() - interval '1 minute' WHERE stripe_checkout_session_id = 'cs_test_sub_300';

\echo '== refund after the lot expired; monthly reset'
SET request.jwt.claims = '{"role":"service_role"}';
SET ROLE service_role;
DO $$
DECLARE j json; r record;
  u constant uuid := 'd0000000-0000-4000-8000-000000000001';
  l300 uuid := (SELECT id FROM public.ai_credit_lots WHERE stripe_checkout_session_id = 'cs_test_sub_300');
  l100 uuid := (SELECT id FROM public.ai_credit_lots WHERE stripe_checkout_session_id = 'cs_test_sub_100');
BEGIN
  j := public.refund_ai_credit(u, 25, 'legal_document', 'c7000000-0000-4000-8000-000000000004');
  PERFORM pg_temp.ok((j ->> 'refunded')::int = 20 AND (j ->> 'monthly_remaining')::int = 20 AND (SELECT credits_remaining FROM public.ai_credit_lots WHERE id = l300) = 295,
                     'refund after the lot expired: monthly part back, the expired lot''s part lost');
  SELECT * INTO r FROM public.ai_credit_ledger WHERE request_id = 'c7000000-0000-4000-8000-000000000004' AND event = 'refund';
  PERFORM pg_temp.ok(r.topup_credits = 0 AND r.topup_lots = jsonb_build_array(jsonb_build_object('lot', l300::text, 'credits', 0, 'lost', 5)), 'the refund row shows the 5 lost credits');
  PERFORM pg_temp.ok((public.get_ai_credits_info(u) ->> 'topup_credits')::int = 100, 'expired lots are not counted');
END $$;
RESET ROLE; RESET request.jwt.claims;
UPDATE public.subscribers SET ai_credits_reset_date = now() - interval '1 minute' WHERE user_id = 'd0000000-0000-4000-8000-000000000001';
SET request.jwt.claims = '{"role":"service_role"}';
SET ROLE service_role;
DO $$
DECLARE j json; u constant uuid := 'd0000000-0000-4000-8000-000000000001';
BEGIN
  j := public.check_and_deduct_ai_credit(u, 1, 'ai_assistant', 'c7000000-0000-4000-8000-000000000005');
  PERFORM pg_temp.ok((j ->> 'monthly_remaining')::int = 249 AND (j ->> 'topup_credits')::int = 100, 'monthly reset: monthly back to the limit (no roll-over), then used first');
  PERFORM pg_temp.ok((SELECT string_agg(credits_remaining::text, ',' ORDER BY purchased_at, credits_purchased DESC) FROM public.ai_credit_lots WHERE user_id = u) = '100,295,100',
                     'monthly reset leaves every lot alone');
  PERFORM pg_temp.ok((SELECT topup_credits FROM public.ai_credit_ledger WHERE request_id = 'c7000000-0000-4000-8000-000000000005' AND event = 'reserve') = 0,
                     'a monthly-only spend records 0 from top-up');
END $$;

\echo '== trial / no row keep 50'
DO $$
DECLARE j json;
BEGIN
  j := public.get_ai_credits_info('d0000000-0000-4000-8000-000000000003');
  PERFORM pg_temp.ok((j ->> 'credits_remaining')::int = 50 AND (j ->> 'monthly_remaining')::int = 50 AND (j ->> 'topup_credits')::int = 0 AND j ->> 'topup_next_expiry' IS NULL,
                     'no subscribers row: 50 credits, no top-up');
  j := public.check_and_deduct_ai_credit('d0000000-0000-4000-8000-000000000002', 10, 'legal_document', 'c7000000-0000-4000-8000-000000000006');
  PERFORM pg_temp.ok((j ->> 'credits_remaining')::int = 40 AND (j ->> 'credits_limit')::int = 50 AND (j ->> 'topup_credits')::int = 0, 'trial: 50 credits, as before');
END $$;

\echo '== void on refund / dispute'
DO $$
DECLARE j json; l100 uuid := (SELECT id FROM public.ai_credit_lots WHERE stripe_checkout_session_id = 'cs_test_sub_100');
BEGIN
  j := public.void_ai_topup(NULL, 'pi_test_sub_100', 'charge.refunded');
  PERFORM pg_temp.ok((j ->> 'removed')::int = 100 AND (SELECT status = 'voided' AND credits_remaining = 0 AND credits_voided = 100 FROM public.ai_credit_lots WHERE id = l100),
                     'void by payment intent: remainder removed, lot voided');
  j := public.void_ai_topup(NULL, 'pi_test_sub_100', 'charge.dispute.created');
  PERFORM pg_temp.ok((j ->> 'duplicate')::boolean AND (j ->> 'removed')::int = 0, 'void: repeat removes nothing');
  j := public.void_ai_topup(NULL, 'pi_test_subscription_invoice', 'charge.refunded');
  PERFORM pg_temp.ok(j ->> 'error' = 'not_found', 'void: a payment that is not a top-up is not_found (subscription refunds unaffected)');
  PERFORM pg_temp.ok((SELECT credits FROM public.ai_credit_ledger WHERE event = 'adjust' AND topup_lots -> 0 ->> 'lot' = l100::text) = -100, 'ledger: adjust row -100');
  PERFORM pg_temp.ok((public.get_ai_credits_info('d0000000-0000-4000-8000-000000000001') ->> 'topup_credits')::int = 0, 'voided credits cannot be spent');
END $$;

\echo '== the 5,000 cap'
DO $$
DECLARE j json; i int;
  u7 constant uuid := 'd0000000-0000-4000-8000-000000000007';
  u6 constant uuid := 'd0000000-0000-4000-8000-000000000006';
BEGIN
  FOR i IN 1..5 LOOP
    j := public.grant_ai_topup(u7, 'credits_1000', 'cs_test_cap_' || i, 'pi_test_cap_' || i, 3500);
  END LOOP;
  PERFORM pg_temp.ok((public.get_ai_credits_info(u7) ->> 'topup_credits')::int = 5000, '5 x 1,000: 5,000 held');
  j := public.begin_ai_topup_checkout(u7, 'credits_100');
  PERFORM pg_temp.ok(j ->> 'error' = 'topup_cap_exceeded' AND (j ->> 'cap')::int = 5000, 'checkout refused before payment at the cap');
  INSERT INTO public.ai_topup_checkouts (user_id, pack_id, credits, amount_pence, stripe_checkout_session_id) VALUES (u7, 'credits_100', 100, 500, 'cs_test_cap_6');
  j := public.grant_ai_topup(u7, 'credits_100', 'cs_test_cap_6', 'pi_test_cap_6', 500);
  PERFORM pg_temp.ok(j ->> 'error' = 'topup_cap_exceeded' AND NOT EXISTS (SELECT 1 FROM public.ai_credit_lots WHERE stripe_checkout_session_id = 'cs_test_cap_6')
                     AND (SELECT status FROM public.ai_topup_checkouts WHERE stripe_checkout_session_id = 'cs_test_cap_6') = 'needs_refund',
                     'grant over the cap: refused, checkout marked needs_refund (never silently dropped)');
  -- Open checkouts count towards the cap (master account: one open 100 already).
  FOR i IN 1..4 LOOP
    UPDATE public.ai_topup_checkouts SET created_at = created_at - interval '2 minutes' WHERE user_id = u6;
    j := public.begin_ai_topup_checkout(u6, 'credits_1000');
    PERFORM pg_temp.ok((j ->> 'success')::boolean, 'open checkout ' || i || ' allowed');
  END LOOP;
  UPDATE public.ai_topup_checkouts SET created_at = created_at - interval '2 minutes' WHERE user_id = u6;
  j := public.begin_ai_topup_checkout(u6, 'credits_1000');
  PERFORM pg_temp.ok(j ->> 'error' = 'topup_cap_exceeded' AND (j ->> 'pending_credits')::int = 4100, 'open, unpaid checkouts count towards the cap');
  UPDATE public.ai_topup_checkouts SET created_at = now() - interval '40 minutes' WHERE user_id = u6;
  j := public.begin_ai_topup_checkout(u6, 'credits_1000');
  PERFORM pg_temp.ok((j ->> 'success')::boolean, 'checkouts older than 35 minutes (Stripe expired them at 30) no longer count');
END $$;
RESET ROLE; RESET request.jwt.claims;

\echo '== users: own lots only, no writes, no service functions'
SET request.jwt.claims = '{"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}';
SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT count(*) FROM public.ai_credit_lots) = 3 AND NOT EXISTS (SELECT 1 FROM public.ai_credit_lots WHERE user_id <> 'd0000000-0000-4000-8000-000000000001'),
                     'RLS: a user sees only their own 3 lots');
  PERFORM pg_temp.ok((public.get_ai_credits_info('d0000000-0000-4000-8000-000000000001') ->> 'monthly_remaining')::int = 249, 'a user reads their own credits');
END $$;
SELECT pg_temp.fails($$UPDATE public.ai_credit_lots SET credits_remaining = 999$$, 'permission denied', 'a user cannot change lots');
SELECT pg_temp.fails($$INSERT INTO public.ai_credit_lots (user_id, credits_purchased, credits_remaining, expires_at, pack_id, amount_pence, currency, stripe_checkout_session_id)
  VALUES ('d0000000-0000-4000-8000-000000000001', 1000, 1000, now() + interval '1 year', 'credits_1000', 3500, 'gbp', 'cs_test_free')$$, 'permission denied', 'a user cannot add lots');
SELECT pg_temp.fails($$SELECT * FROM public.ai_topup_checkouts$$, 'permission denied', 'a user cannot read checkouts');
SELECT pg_temp.fails($$SELECT public.grant_ai_topup('d0000000-0000-4000-8000-000000000001', 'credits_1000', 'cs_test_free', 'pi_test_free', 3500)$$, 'permission denied', 'a user cannot grant credits');
SELECT pg_temp.fails($$SELECT public.begin_ai_topup_checkout('d0000000-0000-4000-8000-000000000001', 'credits_100')$$, 'permission denied', 'a user cannot call begin directly');
SELECT pg_temp.fails($$SELECT public.void_ai_topup(NULL, 'pi_test_cap_1', 'x')$$, 'permission denied', 'a user cannot void');
SELECT pg_temp.fails($$SELECT public.check_and_deduct_ai_credit('d0000000-0000-4000-8000-000000000007', 1, 'ai_assistant', NULL)$$, 'Not authorized', 'a user cannot spend someone else''s credits');
SELECT pg_temp.fails($$SELECT public.admin_ai_topup_summary(30)$$, 'Not authorized', 'admin summary: a normal user is refused');
RESET ROLE; RESET request.jwt.claims;
SET ROLE anon;
SELECT pg_temp.fails($$SELECT * FROM public.ai_credit_lots$$, 'permission denied', 'anon cannot read lots');
SELECT pg_temp.fails($$SELECT public.admin_ai_topup_summary(30)$$, 'permission denied', 'anon cannot call the admin summary');
RESET ROLE;
SELECT pg_temp.fails($$UPDATE public.ai_credit_ledger SET credits = 0 WHERE event = 'topup'$$, 'append-only', 'the ledger is still append-only');

\echo '== admin summary'
SET request.jwt.claims = '{"sub":"d0000000-0000-4000-8000-000000000009","role":"authenticated"}';
SET ROLE authenticated;
SELECT pg_temp.fails($$SELECT public.admin_ai_topup_summary(30)$$, 'MFA_REQUIRED', 'admin summary: super admin without aal2 refused');
RESET ROLE;
SET request.jwt.claims = '{"sub":"d0000000-0000-4000-8000-000000000009","role":"authenticated","aal":"aal2"}';
SET ROLE authenticated;
DO $$
DECLARE j jsonb := public.admin_ai_topup_summary(30);
BEGIN
  -- Lots: sub 300 (expired, 295 left), 100 (voided), old 100 (bought 13 months ago, expired); sub2 5 x 1,000.
  PERFORM pg_temp.ok((j ->> 'packs_sold')::int = 7 AND (j ->> 'revenue_pence')::int = 1200 + 5 * 3500 AND (j ->> 'refunded_pence')::int = 500,
                     'admin: packs sold, revenue and refunded in the last 30 days');
  PERFORM pg_temp.ok((j ->> 'credits_sold')::int = 5500 AND (j ->> 'credits_used')::int = 5 AND (j ->> 'credits_unused')::int = 5000
                     AND (j ->> 'credits_expired')::int = 395 AND (j ->> 'credits_voided')::int = 100, 'admin: credits sold, used, unused, expired, voided');
  PERFORM pg_temp.ok((j ->> 'needs_refund')::int = 1, 'admin: one checkout needs a manual refund');
  PERFORM pg_temp.ok((SELECT (x ->> 'sold')::int FROM jsonb_array_elements(j -> 'by_pack') x WHERE x ->> 'pack_id' = 'credits_1000') = 5, 'admin: by pack');
END $$;
RESET ROLE; RESET request.jwt.claims;
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT count(*) FROM public.ai_credit_ledger WHERE event = 'reserve') = (SELECT reserves FROM t_before) + 5, 'one reserve row per request (Phase 35 / 36 counts unchanged)');
END $$;

