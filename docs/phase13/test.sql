-- Phase 13 test (throwaway Postgres only; run-test.sh). Baseline = production today: support + onboarding harness
-- fixtures, Phase 12 (as live), 12b, 12c. Then proposal.sql, every rule, rollback.sql.
\set ON_ERROR_STOP 1
\i p12-fixture-live.sql
\i p12b-fixture-live.sql
\i p12-proposal.sql
\i p12b-proposal.sql
\i p12c-fixture-live.sql
\i p12c-proposal.sql
CREATE TABLE snap_fn AS SELECT p.proname::text AS name, md5(pg_get_functiondef(p.oid)) AS def, p.proacl::text AS acl
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname IN ('_access_state_for','my_access_state','admin_set_user_status','set_master_access','handle_new_user');

-- Helpers
SET check_function_bodies = off;
CREATE TABLE r(n serial, name text, ok bool, detail text);
CREATE FUNCTION ok(name text, cond bool, detail text DEFAULT '') RETURNS void LANGUAGE sql AS $$ INSERT INTO r(name,ok,detail) VALUES (name, coalesce(cond,false), detail) $$;
CREATE FUNCTION try(stmt text) RETURNS text LANGUAGE plpgsql AS $$ BEGIN EXECUTE stmt; RETURN 'OK'; EXCEPTION WHEN others THEN RETURN 'ERROR ' || SQLSTATE || ' ' || SQLERRM; END $$;
CREATE FUNCTION fresh(q text) RETURNS text LANGUAGE plpgsql VOLATILE AS $$ DECLARE v text; BEGIN EXECUTE q INTO v; RETURN v; END $$;
CREATE FUNCTION uid(e text) RETURNS uuid LANGUAGE sql VOLATILE AS $$ SELECT id FROM auth.users WHERE email = e $$;
CREATE FUNCTION signup(e text, name text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql AS $$ DECLARE i uuid := gen_random_uuid(); BEGIN
  INSERT INTO auth.users(id, email, email_confirmed_at, raw_user_meta_data)
  VALUES (i, e, now(), CASE WHEN name IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('full_name', name) END);
  RETURN i; END $$;
CREATE FUNCTION as_role(r text, stmt text) RETURNS text LANGUAGE plpgsql AS $$ DECLARE res text; BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', r)::text, true);
  EXECUTE format('SET LOCAL ROLE %I', r); res := try(stmt); RESET ROLE;
  PERFORM set_config('request.jwt.claims', '{}', true); RETURN res; END $$;
CREATE FUNCTION as_user(e text, stmt text) RETURNS text LANGUAGE plpgsql AS $$ DECLARE res text; BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid(e), 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated; res := try(stmt); RESET ROLE; PERFORM set_config('request.jwt.claims', '{}', true); RETURN res; END $$;
CREATE FUNCTION set_end(e text, t timestamptz) RETURNS void LANGUAGE sql AS $$ UPDATE public.profiles SET trial_ends_at = t WHERE id = uid(e) $$;
CREATE FUNCTION queue() RETURNS integer LANGUAGE sql AS $$ SELECT public.queue_trial_emails() $$;
CREATE FUNCTION reason(e text) RETURNS text LANGUAGE sql VOLATILE AS $$
  SELECT string_agg(c.kind || ':' || coalesce(c.skip_reason, 'QUEUE'), ',' ORDER BY c.kind) FROM public._trial_email_candidates() c WHERE c.user_id = uid(e) $$;
CREATE FUNCTION queued(e text) RETURNS text LANGUAGE sql VOLATILE AS $$
  SELECT coalesce(string_agg(o.kind || '=' || o.status, ',' ORDER BY o.created_at, o.kind), '-') FROM public.trial_email_outbox o WHERE o.user_id = uid(e) $$;
CREATE FUNCTION token(e text, k text) RETURNS text LANGUAGE sql VOLATILE AS $$ SELECT l.unsubscribe_token FROM public.trial_email_log l WHERE l.user_id = uid(e) AND l.kind = k $$;
SET check_function_bodies = on;

-- People (all verified, trial dates set below). Company: BOSS bills a company where MEM is a member.
SELECT signup(e || '@t.test', n) FROM (VALUES ('soon','Sasha Soon Smith'),('later','Lou Later'),('justended','Jo Ended'),('ended4','Fay Four'),
  ('old','Olly Old'),('sub','Sam Sub'),('master','Mia Master'),('owner','Oscar Owner'),('susp','Sue Suspended'),('boss','Bea Boss'),
  ('mem','Mo Member'),('opt','Otto Optout'),('unv','Uma Unverified'),('cust','Cat Customer'),('sa','Sara Super')) v(e, n);
SELECT set_end('soon@t.test', now() + interval '60 hours'), set_end('later@t.test', now() + interval '10 days'),
       set_end('justended@t.test', now() - interval '2 hours'), set_end('ended4@t.test', now() - interval '4 days'),
       set_end('old@t.test', now() - interval '10 days');
SELECT set_end(e || '@t.test', now() - interval '1 day') FROM unnest(ARRAY['sub','master','owner','susp','boss','mem','opt','unv','cust','sa']) e;
INSERT INTO public.subscribers(user_id, email, subscribed, plan_key, subscription_status) VALUES (uid('sub@t.test'), 'sub@t.test', true, 'starter', 'active');
INSERT INTO public.master_access(user_id, note) VALUES (uid('master@t.test'), 'test');
INSERT INTO public.user_roles(user_id, role) VALUES (uid('owner@t.test'), 'admin'), (uid('sa@t.test'), 'super_admin');
UPDATE public.profiles SET is_active = false WHERE id = uid('susp@t.test');
INSERT INTO public.organization_members(organization_id, user_id, role)
  SELECT b.organization_id, uid('mem@t.test'), 'member' FROM public.organization_billing b WHERE b.billing_user_id = uid('boss@t.test');
UPDATE auth.users SET email_confirmed_at = NULL WHERE email = 'unv@t.test';
INSERT INTO public.support_customers(organization_id, email, user_id, invited_by, claimed_at)
  SELECT b.organization_id, 'cust@t.test', uid('cust@t.test'), uid('boss@t.test'), now() FROM public.organization_billing b WHERE b.billing_user_id = uid('boss@t.test');

-- ============ 1. Apply ============
\i proposal.sql
-- (a second apply, and re-apply after rollback, are checked by run-test.sh)
INSERT INTO public.email_optouts(user_id, scope) VALUES (uid('opt@t.test'), 'trial_emails');

SELECT ok('Earlier functions untouched (_access_state_for, my_access_state, admin_set_user_status, set_master_access, handle_new_user)',
  (SELECT count(*) FROM snap_fn s JOIN pg_proc p ON p.proname = s.name JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
    WHERE md5(pg_get_functiondef(p.oid)) = s.def AND p.proacl::text IS NOT DISTINCT FROM s.acl) = 5);
SELECT ok('Settings: one row, switched OFF, cap 50, default timings 48/72/72/48 h, catch-up 7 days',
  (SELECT count(*) FROM public.trial_email_settings) = 1
  AND (SELECT NOT enabled AND daily_cap = 50 AND reminder_from_hours = 48 AND reminder_to_hours = 72 AND followup_after_hours = 72
        AND followup_gap_hours = 48 AND catchup_max_days = 7 FROM public.trial_email_settings));
SELECT ok('A second settings row is impossible', try('INSERT INTO public.trial_email_settings(id) VALUES (false)') LIKE 'ERROR%');

-- ============ 2. Security ============
SELECT ok('All four tables: RLS on, no policies, nothing for anon / authenticated',
  (SELECT bool_and(c.relrowsecurity) AND count(*) = 4 FROM pg_class c WHERE c.oid IN ('public.trial_email_settings'::regclass,
     'public.email_optouts'::regclass, 'public.trial_email_outbox'::regclass, 'public.trial_email_log'::regclass))
  AND NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid IN ('public.trial_email_settings'::regclass, 'public.email_optouts'::regclass,
     'public.trial_email_outbox'::regclass, 'public.trial_email_log'::regclass))
  AND NOT EXISTS (SELECT 1 FROM unnest(ARRAY['trial_email_settings','email_optouts','trial_email_outbox','trial_email_log']) t,
     unnest(ARRAY['anon','authenticated']) ro, unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE']) pr
     WHERE has_table_privilege(ro, 'public.' || t, pr)));
SELECT ok('A signed-in user cannot read the log, the outbox, the opt-outs or the settings, nor switch it on',
  as_user('soon@t.test', 'SELECT * FROM public.trial_email_log') LIKE 'ERROR 42501%'
  AND as_user('soon@t.test', 'SELECT * FROM public.trial_email_outbox') LIKE 'ERROR 42501%'
  AND as_user('soon@t.test', 'SELECT * FROM public.email_optouts') LIKE 'ERROR 42501%'
  AND as_user('soon@t.test', 'UPDATE public.trial_email_settings SET enabled = true') LIKE 'ERROR 42501%');
SELECT ok('anon and authenticated cannot call queue, candidates, claim, finish or the rules',
  NOT EXISTS (SELECT 1 FROM unnest(ARRAY['anon','authenticated']) ro, unnest(ARRAY['public.queue_trial_emails()','public._trial_email_candidates()',
     'public.trial_email_claim(integer)','public.trial_email_finish(uuid,text,text)','public._trial_email_skip_reason(uuid,text)']) f
     WHERE has_function_privilege(ro, f, 'EXECUTE'))
  AND as_role('authenticated', 'SELECT public.queue_trial_emails()') LIKE 'ERROR 42501%'
  AND as_role('anon', 'SELECT * FROM public.trial_email_claim(5)') LIKE 'ERROR 42501%');
SELECT ok('service_role can run everything; only email_unsubscribe is open to anon / authenticated',
  has_function_privilege('service_role', 'public.queue_trial_emails()', 'EXECUTE') AND has_function_privilege('service_role', 'public.trial_email_claim(integer)', 'EXECUTE')
  AND has_function_privilege('anon', 'public.email_unsubscribe(text)', 'EXECUTE') AND has_function_privilege('authenticated', 'public.email_unsubscribe(text)', 'EXECUTE')
  AND NOT EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a WHERE p.proname IN ('queue_trial_emails','trial_email_claim','trial_email_finish',
        '_trial_email_candidates','_trial_email_skip_reason','email_unsubscribe') AND a.grantee = 0));
SELECT ok('Every new function: SET search_path = ''''',
  (SELECT bool_and(proconfig = ARRAY['search_path=""']) AND count(*) = 6 FROM pg_proc WHERE proname IN ('queue_trial_emails','trial_email_claim',
     'trial_email_finish','_trial_email_candidates','_trial_email_skip_reason','email_unsubscribe')));

-- ============ 3. Who gets what (decided by _access_state_for) ============
SELECT ok('Running trial ending in 60 hours: "ends in 3 days" is due', reason('soon@t.test') = 'ending_soon:QUEUE', reason('soon@t.test'));
SELECT ok('Trial ending in 10 days: nothing due', reason('later@t.test') IS NULL);
SELECT ok('Trial ended 2 hours ago: "has ended" is due', reason('justended@t.test') = 'ended:QUEUE');
SELECT ok('Trial ended 4 days ago (within the 7-day catch-up): "has ended" is due first', reason('ended4@t.test') = 'ended:QUEUE');
SELECT ok('Trial ended 10 days ago: never emailed (catch-up rule)', reason('old@t.test') = 'ended:ended_too_long_ago');
SELECT ok('Subscriber: never', reason('sub@t.test') = 'ended:subscribed');
SELECT ok('Master account: never', reason('master@t.test') = 'ended:owner_or_master');
SELECT ok('Owner (admin role): never', reason('owner@t.test') = 'ended:owner_or_master');
SELECT ok('Suspended: never', reason('susp@t.test') = 'ended:suspended');
SELECT ok('Company member whose access follows the owner: never (nothing for them in this phase)', reason('mem@t.test') = 'ended:company_member');
SELECT ok('The company''s billing owner (via self) is emailed', reason('boss@t.test') = 'ended:QUEUE');
SELECT ok('Opted out: never', reason('opt@t.test') = 'ended:opted_out');
SELECT ok('Unverified email: never', reason('unv@t.test') = 'ended:no_verified_email');
SELECT ok('Support customer: never', reason('cust@t.test') = 'ended:support_customer');

-- ============ 4. Kill switch ============
SELECT ok('Switch OFF: queue does nothing and returns 0', queue() = 0 AND (SELECT count(*) FROM public.trial_email_outbox) = 0 AND (SELECT count(*) FROM public.trial_email_log) = 0);
SELECT ok('Switch OFF: claim returns nothing', (SELECT count(*) FROM public.trial_email_claim(50)) = 0);

-- ============ 5. Queue, idempotency, cap ============
UPDATE public.trial_email_settings SET enabled = true;
SELECT ok('Switch ON: exactly soon, justended, ended4 and boss are queued (4)', queue() = 4
  AND queued('soon@t.test') = 'ending_soon=pending' AND queued('justended@t.test') = 'ended=pending' AND queued('ended4@t.test') = 'ended=pending'
  AND queued('boss@t.test') = 'ended=pending'
  AND fresh('SELECT count(*)::text FROM public.trial_email_outbox') = '4',
  fresh($q$SELECT string_agg(u.email || ':' || o.kind, ', ') FROM public.trial_email_outbox o JOIN auth.users u ON u.id = o.user_id$q$));
SELECT ok('Log rows match the outbox one-to-one, each with its own 64-hex unsubscribe token',
  (SELECT count(*) FROM public.trial_email_log l JOIN public.trial_email_outbox o ON o.id = l.outbox_id
    WHERE o.user_id = l.user_id AND o.kind = l.kind AND o.trial_ends_at = l.trial_ends_at AND l.unsubscribe_token ~ '^[0-9a-f]{64}$') = 4
  AND (SELECT count(DISTINCT unsubscribe_token) FROM public.trial_email_log) = 4);
SELECT ok('Idempotent: a second run queues nothing', queue() = 0 AND (SELECT count(*) FROM public.trial_email_outbox) = 4);
SELECT ok('Never twice: the unique key refuses a duplicate even written by hand',
  try(format('INSERT INTO public.trial_email_log(user_id, kind, trial_ends_at) SELECT user_id, kind, trial_ends_at FROM public.trial_email_log WHERE user_id = %L', uid('soon@t.test'))) LIKE 'ERROR 23505%');
-- follow_up: "has ended" for ended4 was queued 49 hours ago (moved back in time), and the trial ended 4 days ago
UPDATE public.trial_email_log SET queued_at = now() - interval '49 hours' WHERE user_id = uid('ended4@t.test');
SELECT ok('"Still here" is due 3+ days after the end and 48+ hours after "has ended"', reason('ended4@t.test') = 'follow_up:QUEUE', reason('ended4@t.test'));
SELECT ok('…but not for a trial that ended 2 hours ago', reason('justended@t.test') IS NULL);
SELECT ok('Ended 80 hours ago with no "has ended" yet: "has ended" comes first, never "still here" first',
  (SELECT set_end('later@t.test', now() - interval '80 hours')) IS NULL AND reason('later@t.test') = 'ended:QUEUE');
-- Daily cap: 5 today already counts the moved-back row? It was moved to yesterday, so today = 3.
UPDATE public.trial_email_settings SET daily_cap = 3;
SELECT ok('Daily cap reached (3 queued today): nothing more is queued', queue() = 0 AND queued('ended4@t.test') = 'ended=pending');
UPDATE public.trial_email_settings SET daily_cap = 4;
SELECT ok('Cap raised by one: exactly one more, the most urgent first ("has ended" before "still here")',
  queue() = 1 AND queued('later@t.test') = 'ended=pending' AND queued('ended4@t.test') = 'ended=pending');
UPDATE public.trial_email_settings SET daily_cap = 50;
SELECT ok('Cap back to 50: the follow-up is queued; still at most three emails per trial', queue() = 1
  AND queued('ended4@t.test') = 'ended=pending,follow_up=pending'
  AND (SELECT max(n) FROM (SELECT count(*) n FROM public.trial_email_log GROUP BY user_id, trial_ends_at) x) <= 3);
SELECT ok('Cap 0 queues nothing at all', (SELECT set_end('later@t.test', now() + interval '50 hours')) IS NULL
  AND (SELECT count(*) FROM public.trial_email_settings WHERE id) = 1 AND try('UPDATE public.trial_email_settings SET daily_cap = 0') = 'OK' AND queue() = 0);
UPDATE public.trial_email_settings SET daily_cap = 50;
SELECT ok('A NEW trial end date is a new trial (the same person can get "ends soon" again)', queue() = 1
  AND queued('later@t.test') = 'ended=pending,ending_soon=pending');

-- ============ 6. Claim re-checks the rules ============
INSERT INTO public.subscribers(user_id, email, subscribed, plan_key, subscription_status) VALUES (uid('soon@t.test'), 'soon@t.test', true, 'starter', 'active');
INSERT INTO public.master_access(user_id, note) VALUES (uid('justended@t.test'), 'became master');
UPDATE public.profiles SET is_active = false WHERE id = uid('later@t.test');
CREATE TABLE claimed AS SELECT * FROM public.trial_email_claim(50);
SELECT ok('Subscribed after queueing: cancelled at claim, never sent', queued('soon@t.test') = 'ending_soon=cancelled'
  AND fresh(format('SELECT last_error FROM public.trial_email_outbox WHERE user_id = %L', uid('soon@t.test'))) = 'no longer eligible: subscribed');
SELECT ok('Became a master account after queueing: cancelled', queued('justended@t.test') = 'ended=cancelled');
SELECT ok('Suspended after queueing: both cancelled', queued('later@t.test') = 'ended=cancelled,ending_soon=cancelled');
SELECT ok('Only ended4 (2 emails) and boss were claimed, marked sending, attempt 1',
  (SELECT string_agg(c.recipient_email || ':' || c.kind, ',' ORDER BY c.recipient_email, c.kind) FROM claimed c) = 'boss@t.test:ended,ended4@t.test:ended,ended4@t.test:follow_up'
  AND (SELECT count(*) FROM public.trial_email_outbox WHERE status = 'sending' AND attempts = 1) = 3,
  (SELECT string_agg(c.recipient_email || ':' || c.kind, ',') FROM claimed c));
SELECT ok('Claim gives the sender what the template needs: first name, date, days left, token',
  (SELECT c.first_name = 'Bea' AND c.days_left = 0 AND c.trial_ends_at IS NOT NULL AND c.unsubscribe_token ~ '^[0-9a-f]{64}$' FROM claimed c WHERE c.recipient_email = 'boss@t.test'));
SELECT ok('A second claim while they are sending returns nothing', (SELECT count(*) FROM public.trial_email_claim(50)) = 0);

-- ============ 7. Finish ============
SELECT public.trial_email_finish(id, 'accepted_by_provider', '250 2.0.0 OK queued') FROM claimed WHERE recipient_email = 'boss@t.test';
SELECT public.trial_email_finish(id, 'failed', 'stage=auth 535 bad credentials') FROM claimed WHERE recipient_email = 'ended4@t.test' AND kind = 'ended';
SELECT public.trial_email_finish(id, 'uncertain', 'stage=data_end connection closed') FROM claimed WHERE recipient_email = 'ended4@t.test' AND kind = 'follow_up';
SELECT ok('Accepted: recorded with the provider reply', queued('boss@t.test') = 'ended=accepted_by_provider'
  AND fresh(format('SELECT provider_reply FROM public.trial_email_outbox WHERE user_id = %L', uid('boss@t.test'))) = '250 2.0.0 OK queued');
SELECT ok('Failed before DATA: not sent, retried later with backoff (5 minutes after attempt 1)',
  fresh(format('SELECT status || '':'' || (next_attempt_at > now() + interval ''4 minutes'')::text FROM public.trial_email_outbox WHERE user_id = %L AND kind = ''ended''', uid('ended4@t.test'))) = 'failed:true');
SELECT ok('Uncertain (after DATA): never claimed again automatically', (SELECT count(*) FROM public.trial_email_claim(50)) = 0
  AND fresh(format('SELECT status FROM public.trial_email_outbox WHERE user_id = %L AND kind = ''follow_up''', uid('ended4@t.test'))) = 'uncertain');
SELECT public.trial_email_finish(id, 'failed', 'x') FROM claimed WHERE recipient_email = 'boss@t.test';
SELECT ok('Finish only touches rows that are sending (a second finish changes nothing)', queued('boss@t.test') = 'ended=accepted_by_provider');
SELECT ok('An invalid outcome is refused', try(format('SELECT public.trial_email_finish(%L, %L, %L)', gen_random_uuid(), 'sent', 'x')) LIKE 'ERROR%invalid outcome%');
UPDATE public.trial_email_outbox SET next_attempt_at = now() - interval '1 minute' WHERE user_id = uid('ended4@t.test') AND kind = 'ended';
UPDATE public.trial_email_settings SET enabled = false;
SELECT ok('Switch OFF after queueing: the retry is not claimed (it waits)', (SELECT count(*) FROM public.trial_email_claim(50)) = 0
  AND fresh(format('SELECT status FROM public.trial_email_outbox WHERE user_id = %L AND kind = ''ended''', uid('ended4@t.test'))) = 'failed');
UPDATE public.trial_email_settings SET enabled = true;
SELECT ok('A sender that dies mid-send leaves "sending"; the next claim turns it into "uncertain", never resent',
  (SELECT count(*) FROM public.trial_email_claim(50)) = 1
  AND try(format('UPDATE public.trial_email_outbox SET locked_until = now() - interval ''1 minute'' WHERE user_id = %L AND kind = ''ended''', uid('ended4@t.test'))) = 'OK'
  AND (SELECT count(*) FROM public.trial_email_claim(50)) = 0
  AND fresh(format('SELECT status FROM public.trial_email_outbox WHERE user_id = %L AND kind = ''ended''', uid('ended4@t.test'))) = 'uncertain');

-- ============ 8. One-click unsubscribe ============
SELECT set_end('later@t.test', now() + interval '200 days'); UPDATE public.profiles SET is_active = true WHERE id = uid('later@t.test');
SELECT signup('fresh@t.test', 'Fred Fresh'); SELECT set_end('fresh@t.test', now() + interval '55 hours');
SELECT ok('A new person is queued', queue() = 1 AND queued('fresh@t.test') = 'ending_soon=pending');
SELECT ok('anon with a VALID token: OK, opt-out recorded, the queued email cancelled',
  as_role('anon', format('SELECT public.email_unsubscribe(%L)', token('fresh@t.test', 'ending_soon'))) = 'OK'
  AND fresh(format('SELECT count(*)::text FROM public.email_optouts WHERE user_id = %L AND scope = ''trial_emails''', uid('fresh@t.test'))) = '1'
  AND queued('fresh@t.test') = 'ending_soon=cancelled');
SELECT ok('Clicking again: the same answer, no error, still one opt-out',
  as_role('anon', format('SELECT public.email_unsubscribe(%L)', token('fresh@t.test', 'ending_soon'))) = 'OK'
  AND fresh(format('SELECT count(*)::text FROM public.email_optouts WHERE user_id = %L', uid('fresh@t.test'))) = '1');
SELECT ok('An INVALID token (right shape) and a malformed one: the same answer, nothing changes',
  as_role('anon', format('SELECT public.email_unsubscribe(%L)', repeat('a', 64))) = 'OK'
  AND as_role('anon', $q$SELECT public.email_unsubscribe('not-a-token'' OR 1=1 --')$q$) = 'OK'
  AND as_role('anon', 'SELECT public.email_unsubscribe(NULL)') = 'OK'
  AND (SELECT count(*) FROM public.email_optouts) = 2);
SELECT ok('The answer reveals nothing (returns void for every token)', (SELECT prorettype = 'void'::regtype FROM pg_proc WHERE proname = 'email_unsubscribe'));
SELECT ok('After opting out the person is skipped for every email', reason('fresh@t.test') IS NULL
  AND public._trial_email_skip_reason(uid('fresh@t.test'), 'ended') = 'opted_out');
SELECT ok('A signed-in user can also use the link (same function), but still cannot read the opt-outs',
  as_user('soon@t.test', format('SELECT public.email_unsubscribe(%L)', token('soon@t.test', 'ending_soon'))) = 'OK'
  AND as_user('soon@t.test', 'SELECT count(*) FROM public.email_optouts') LIKE 'ERROR 42501%');

-- ============ 9. The precheck counts the same as the function ============
-- precheck.sql runs BEFORE the feature exists (no log, no opt-outs), so compare on an empty queue.
UPDATE public.trial_email_settings SET enabled = false;
DELETE FROM public.trial_email_log; DELETE FROM public.trial_email_outbox; DELETE FROM public.email_optouts;
CREATE TABLE before_counts AS SELECT c.kind, coalesce(c.skip_reason, 'WOULD BE QUEUED') AS outcome, count(*) AS accounts
  FROM public._trial_email_candidates() c GROUP BY 1, 2;
\i precheck-as-table.sql
SELECT ok('precheck.sql counts exactly what _trial_email_candidates would decide (every kind and every reason)',
  (SELECT string_agg(kind || '/' || outcome || '=' || accounts, ' ' ORDER BY kind, outcome) FROM pc)
  = (SELECT string_agg(kind || '/' || outcome || '=' || accounts, ' ' ORDER BY kind, outcome) FROM before_counts),
  (SELECT string_agg(kind || '/' || outcome || '=' || accounts, ' ' ORDER BY kind, outcome) FROM pc) || ' vs ' ||
  (SELECT string_agg(kind || '/' || outcome || '=' || accounts, ' ' ORDER BY kind, outcome) FROM before_counts));
SELECT ok('precheck.sql is read-only', pg_read_file(current_setting('p13.dir') || '/precheck.sql') !~* '\m(insert|update|delete|alter|grant|revoke|create|drop|truncate)\M');

-- ============ 10. rollback.sql ============
\i rollback.sql
SELECT ok('Rollback: every table and function is gone', to_regclass('public.trial_email_settings') IS NULL AND to_regclass('public.trial_email_log') IS NULL
  AND to_regclass('public.trial_email_outbox') IS NULL AND to_regclass('public.email_optouts') IS NULL
  AND NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname IN ('queue_trial_emails','trial_email_claim','trial_email_finish','_trial_email_candidates',
     '_trial_email_skip_reason','email_unsubscribe')));
SELECT ok('Rollback: earlier functions still untouched',
  (SELECT count(*) FROM snap_fn s JOIN pg_proc p ON p.proname = s.name JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
    WHERE md5(pg_get_functiondef(p.oid)) = s.def AND p.proacl::text IS NOT DISTINCT FROM s.acl) = 5);

SELECT CASE WHEN ok THEN 'PASS|' ELSE 'FAIL|' END || name || CASE WHEN ok OR coalesce(detail, '') = '' THEN '' ELSE ' [' || detail || ']' END FROM r ORDER BY n;
SELECT 'TOTAL|' || count(*) FILTER (WHERE ok) || ' passed, ' || count(*) FILTER (WHERE NOT ok) || ' failed' FROM r;
