-- Phase 39b tests (DISPOSABLE local Postgres only). Run by docs/phase39b/run-test.sh after the shim, the Phase 35 / 36 /
-- 37 / 31 fixtures and docs/phase39/proposal.sql (the production Phase 39 body, hash-checked).
\set ON_ERROR_STOP 1
\i docs/phase37/test-helpers.sql

-- People (cb…0NN): 1 signed up from the Cost Calculator (no checkbox), 2 odd source, 3 old sign-up who ticked the box,
-- 4 nothing in the sign-up details, 5 already has a row, 6 two-step set up, 7 old sign-up who did not tick.
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('cb000000-0000-4000-8000-000000000001', 'cost@example.test', '{"full_name": "Cost", "signup_source": "cost-calculator"}'),
  ('cb000000-0000-4000-8000-000000000002', 'odd@example.test', '{"signup_source": "<script>"}'),
  ('cb000000-0000-4000-8000-000000000003', 'yes@example.test', '{"marketing_consent": true, "signup_source": "roi-calculator"}'),
  ('cb000000-0000-4000-8000-000000000004', 'none@example.test', '{"full_name": "None"}'),
  ('cb000000-0000-4000-8000-000000000005', 'row@example.test', '{"signup_source": "goal-tracker"}'),
  ('cb000000-0000-4000-8000-000000000006', 'mfa@example.test', '{"signup_source": "compliance"}'),
  ('cb000000-0000-4000-8000-000000000007', 'no@example.test', '{"marketing_consent": false, "signup_source": "setup-checklist"}');
INSERT INTO auth.mfa_factors (user_id, status) VALUES ('cb000000-0000-4000-8000-000000000006', 'verified');
INSERT INTO public.marketing_consents (user_id, consented, source, consent_text_version, consented_at)
VALUES ('cb000000-0000-4000-8000-000000000005', true, 'settings', 'v1', now() - interval '2 days');
CREATE FUNCTION pg_temp.who(n int, aal text DEFAULT 'aal1') RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', 'cb000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'), 'role', 'authenticated', 'aal', aal)::text, false) $$;
CREATE FUNCTION pg_temp.u(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('cb000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid $$;
GRANT EXECUTE ON FUNCTION pg_temp.who(int, text), pg_temp.u(int) TO PUBLIC;

\echo '== before: the Phase 39 function records nothing without a checkbox choice'
SELECT pg_temp.who(1); SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.ok((public.marketing_consent_record_signup() ->> 'reason') = 'no_choice', 'Phase 39 body: a sign-up source alone records nothing (no error)');
END $$;
RESET ROLE; RESET request.jwt.claims;

\echo '== apply'
\i docs/phase39b/proposal.sql
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT array_agg(x ORDER BY x) FROM unnest((SELECT proacl::text[] FROM pg_proc WHERE oid = 'public.marketing_consent_record_signup()'::regprocedure)) x)
                     = ARRAY['authenticated=X/postgres','postgres=X/postgres'], 'privileges unchanged: authenticated only, not anon');
  PERFORM pg_temp.ok((SELECT prosecdef AND proconfig @> ARRAY['search_path=""'] FROM pg_proc WHERE oid = 'public.marketing_consent_record_signup()'::regprocedure),
                     'SECURITY DEFINER, search_path pinned');
  PERFORM pg_temp.ok((SELECT md5(p.prosrc) = g.new_md5 AND md5(replace(p.prosrc, E'\n  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard', '')) = g.old_md5
                             AND g.new_md5 <> '92b26481e8c7b688d055bde1c0360953' AND g.kind = 'user'
                        FROM pg_proc p, public.phase25_mfa_guard_log g
                       WHERE p.oid = 'public.marketing_consent_record_signup()'::regprocedure AND g.fn = 'public.marketing_consent_record_signup()'),
                     'guard line kept; guard log row updated to the new body hash');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.phase25_mfa_guard_log) = (SELECT n FROM t39b.guard_rows), 'no guard log row added or removed');
  PERFORM pg_temp.ok((SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.marketing_consent_set(boolean,text)'::regprocedure) = (SELECT set_md5 FROM t39b.guard_rows),
                     'marketing_consent_set untouched');
END $$;

\echo '== after'
SELECT pg_temp.who(1); SET ROLE authenticated;
DO $$ DECLARE j json; BEGIN
  j := public.marketing_consent_record_signup();
  PERFORM pg_temp.ok((j ->> 'recorded')::boolean AND NOT (j ->> 'consented')::boolean AND j ->> 'source' = 'cost-calculator',
                     'sign-up from the Cost Calculator, no checkbox: recorded no, source cost-calculator');
  PERFORM pg_temp.ok((SELECT NOT consented AND consented_at IS NULL AND consent_text_version = 'v1' FROM public.marketing_consents),
                     'no consented_at (never agreed)');
  j := public.marketing_consent_record_signup();
  PERFORM pg_temp.ok(j ->> 'reason' = 'already_recorded', 'recorded once only');
  j := public.marketing_consent_set(true);
  PERFORM pg_temp.ok((SELECT consented AND consented_at IS NOT NULL AND source = 'cost-calculator' FROM public.marketing_consents),
                     'opting in later in Settings works; the sign-up source is kept');
END $$;
RESET ROLE;
SELECT pg_temp.who(2); SET ROLE authenticated;
DO $$ DECLARE j json; BEGIN
  j := public.marketing_consent_record_signup();
  PERFORM pg_temp.ok((j ->> 'recorded')::boolean AND NOT (j ->> 'consented')::boolean AND j ->> 'source' = 'signup', 'an unknown source becomes signup, recorded no');
END $$;
RESET ROLE;
SELECT pg_temp.who(3); SET ROLE authenticated;
DO $$ DECLARE j json; BEGIN
  j := public.marketing_consent_record_signup();
  PERFORM pg_temp.ok((j ->> 'consented')::boolean AND j ->> 'source' = 'roi-calculator', 'an explicit yes from the old checkbox is still recorded as yes');
END $$;
RESET ROLE;
SELECT pg_temp.who(7); SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.ok(NOT (public.marketing_consent_record_signup() ->> 'consented')::boolean, 'an explicit no is recorded as no');
END $$;
RESET ROLE;
SELECT pg_temp.who(4); SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.ok(public.marketing_consent_record_signup() ->> 'reason' = 'no_choice' AND NOT EXISTS (SELECT 1 FROM public.marketing_consents),
                     'nothing in the sign-up details (OAuth, older accounts): nothing recorded');
END $$;
RESET ROLE;
SELECT pg_temp.who(5); SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.ok(public.marketing_consent_record_signup() ->> 'reason' = 'already_recorded'
                     AND (SELECT consented AND source = 'settings' FROM public.marketing_consents), 'an existing choice is never overwritten');
END $$;
RESET ROLE;
SELECT pg_temp.who(6); SET ROLE authenticated;
SELECT pg_temp.fails($$SELECT public.marketing_consent_record_signup()$$, 'MFA_REQUIRED', 'two-step set up, code not entered: refused');
RESET ROLE;
SELECT pg_temp.who(6, 'aal2'); SET ROLE authenticated;
DO $$ BEGIN PERFORM pg_temp.ok((public.marketing_consent_record_signup() ->> 'source') = 'compliance', 'with the code (aal2): recorded'); END $$;
RESET ROLE; RESET request.jwt.claims;
SET ROLE anon;
SELECT pg_temp.fails($$SELECT public.marketing_consent_record_signup()$$, 'permission denied', 'anon: refused');
RESET ROLE;
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT string_agg(right(user_id::text, 2) || '=' || consented || ':' || source, ' ' ORDER BY user_id) FROM public.marketing_consents)
    = '01=true:cost-calculator 02=false:signup 03=true:roi-calculator 05=true:settings 06=false:compliance 07=false:setup-checklist',
    'every row as expected; only explicit choices are yes');
END $$;
