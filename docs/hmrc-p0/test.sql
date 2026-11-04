-- HMRC P0 tests (DISPOSABLE local Postgres only). Run by docs/hmrc-p0/run-test.sh after the shim, the Phase 35 / 36 / 37
-- / 31 fixtures (organisations, members, billing, _access_state_for, mfa_ok, the organisation helpers, verbatim) and
-- docs/hmrc-p0/fixture.sql (the HMRC tables, grants and old functions as production).
\set ON_ERROR_STOP 1
\i docs/phase37/test-helpers.sql

-- People (d1…0NN). Company A (O1): 1 owner (pays), 2 admin, 3 member, 8 suspended admin, 9 admin with two-step set up.
-- 4 super admin and 5 master account, neither in company A. 6 owner of company B (O2). 7 admin whose own company (O3)
-- trial has ended. 10 owner of company D (O4) on a trial. 11 nobody's member.
INSERT INTO auth.users (id, email) SELECT ('d1000000-0000-4000-8000-0000000000' || lpad(x::text, 2, '0'))::uuid, 'p' || x || '@example.test' FROM generate_series(1, 11) x;
INSERT INTO public.profiles (id, email, full_name, trial_ends_at, is_active)
SELECT ('d1000000-0000-4000-8000-0000000000' || lpad(x::text, 2, '0'))::uuid, 'p' || x || '@example.test', 'Person ' || x,
       CASE WHEN x = 7 THEN now() - interval '2 days' WHEN x = 10 THEN now() + interval '5 days' END, x <> 8
  FROM generate_series(1, 11) x;
INSERT INTO public.subscribers (user_id, email, subscribed, subscription_status, plan_key) VALUES
  ('d1000000-0000-4000-8000-000000000001', 'p1@example.test', true, 'active', 'starter'),
  ('d1000000-0000-4000-8000-000000000006', 'p6@example.test', true, 'active', 'starter');
INSERT INTO public.user_roles (user_id, role) VALUES ('d1000000-0000-4000-8000-000000000004', 'super_admin');
INSERT INTO public.master_access (user_id, note) VALUES ('d1000000-0000-4000-8000-000000000005', 'testing');
INSERT INTO auth.mfa_factors (user_id, status) VALUES ('d1000000-0000-4000-8000-000000000009', 'verified');
INSERT INTO public.organizations (id, name, created_by) VALUES
  ('0d100000-0000-4000-8000-000000000001', 'A Ltd', 'd1000000-0000-4000-8000-000000000001'),
  ('0d100000-0000-4000-8000-000000000002', 'B Ltd', 'd1000000-0000-4000-8000-000000000006'),
  ('0d100000-0000-4000-8000-000000000003', 'C Ltd', 'd1000000-0000-4000-8000-000000000007'),
  ('0d100000-0000-4000-8000-000000000004', 'D Ltd', 'd1000000-0000-4000-8000-000000000010');
INSERT INTO public.organization_members (organization_id, user_id, role) VALUES
  ('0d100000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'owner'),
  ('0d100000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000002', 'admin'),
  ('0d100000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000003', 'member'),
  ('0d100000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000008', 'admin'),
  ('0d100000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000009', 'admin'),
  ('0d100000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000006', 'owner'),
  ('0d100000-0000-4000-8000-000000000003', 'd1000000-0000-4000-8000-000000000007', 'admin'),
  ('0d100000-0000-4000-8000-000000000004', 'd1000000-0000-4000-8000-000000000010', 'owner');
INSERT INTO public.organization_billing (organization_id, billing_user_id) VALUES
  ('0d100000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001'),
  ('0d100000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000006'),
  ('0d100000-0000-4000-8000-000000000003', 'd1000000-0000-4000-8000-000000000007'),
  ('0d100000-0000-4000-8000-000000000004', 'd1000000-0000-4000-8000-000000000010');

CREATE FUNCTION pg_temp.who(n int, aal text DEFAULT 'aal1') RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', 'd1000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'), 'role', 'authenticated', 'aal', aal)::text, false) $$;
CREATE FUNCTION pg_temp.u(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('d1000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid $$;
CREATE FUNCTION pg_temp.o(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('0d100000-0000-4000-8000-00000000000' || n)::uuid $$;
GRANT EXECUTE ON FUNCTION pg_temp.who(int, text), pg_temp.u(int), pg_temp.o(int) TO PUBLIC;

\echo '== apply'
\i docs/hmrc-p0/proposal.sql
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.hmrc_can_manage(uuid)', 'public.hmrc_connection_status(uuid)', 'public.hmrc_audit_events(uuid,integer)'] LOOP
    PERFORM pg_temp.ok((SELECT array_agg(x ORDER BY x) FROM unnest((SELECT proacl::text[] FROM pg_proc WHERE oid = f::regprocedure)) x)
      = ARRAY['authenticated=X/postgres','postgres=X/postgres'], f || ': authenticated only');
    PERFORM pg_temp.ok((SELECT prosecdef AND proconfig @> ARRAY['search_path=""'] FROM pg_proc WHERE oid = f::regprocedure), f || ': SECURITY DEFINER, search_path pinned');
  END LOOP;
  FOREACH f IN ARRAY ARRAY['public.hmrc_manage_allowed(uuid,uuid)', 'public.hmrc_consume_state(text,uuid)', 'public.hmrc_claim_refresh(uuid,text,integer)'] LOOP
    PERFORM pg_temp.ok((SELECT array_agg(x ORDER BY x) FROM unnest((SELECT proacl::text[] FROM pg_proc WHERE oid = f::regprocedure)) x)
      = ARRAY['postgres=X/postgres','service_role=X/postgres'] AND NOT (SELECT prosecdef FROM pg_proc WHERE oid = f::regprocedure), f || ': service role only, not SECURITY DEFINER');
  END LOOP;
  PERFORM pg_temp.ok((SELECT count(*) FROM public.phase25_mfa_guard_log g JOIN pg_proc p ON p.oid = to_regprocedure(g.fn)
                       WHERE g.fn ~ '^public\.hmrc_' AND g.kind = 'user' AND md5(p.prosrc) = g.new_md5
                         AND md5(replace(p.prosrc, E'\n  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard', '')) = g.old_md5) = 3,
                     'guard log: 3 rows, md5s right');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.phase25_mfa_guard_log WHERE fn ~ 'get_hmrc'), 'guard log: old get_hmrc_* rows removed');
  PERFORM pg_temp.ok(to_regprocedure('public.get_hmrc_tokens(uuid)') IS NULL AND to_regprocedure('public.get_hmrc_client_secret(uuid)') IS NULL
                     AND to_regprocedure('public.encrypt_hmrc_token(text)') IS NULL AND to_regprocedure('public.decrypt_hmrc_token(text)') IS NULL
                     AND to_regprocedure('public.encrypt_hmrc_settings_secret()') IS NULL, 'old functions gone (decoded tokens, client secret, base64 "encryption")');
  PERFORM pg_temp.ok((SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('hmrc_connections', 'hmrc_oauth_states', 'hmrc_audit_log')
                       AND policyname = 'require_aal2_if_enrolled' AND permissive = 'RESTRICTIVE') = 3
                     AND (SELECT bool_and(relrowsecurity) FROM pg_class WHERE oid IN ('public.hmrc_connections'::regclass, 'public.hmrc_oauth_states'::regclass, 'public.hmrc_audit_log'::regclass)),
                     'RLS and the restrictive aal2 policy on the three new tables');
  PERFORM pg_temp.ok(NOT has_table_privilege('authenticated', 'public.hmrc_connections', 'SELECT,INSERT,UPDATE,DELETE')
                     AND NOT has_any_column_privilege('authenticated', 'public.hmrc_connections', 'SELECT')
                     AND NOT has_any_column_privilege('anon', 'public.hmrc_connections', 'SELECT')
                     AND NOT has_table_privilege('authenticated', 'public.hmrc_oauth_states', 'SELECT,INSERT')
                     AND NOT has_table_privilege('authenticated', 'public.hmrc_audit_log', 'SELECT,INSERT')
                     AND NOT has_table_privilege('anon', 'public.hmrc_audit_log', 'SELECT'), 'tokens, states and audit log: no client access at all');
  PERFORM pg_temp.ok(NOT has_any_column_privilege('authenticated', 'public.hmrc_integrations', 'SELECT,INSERT,UPDATE,REFERENCES')
                     AND NOT has_table_privilege('authenticated', 'public.hmrc_integrations', 'DELETE')
                     AND NOT has_any_column_privilege('anon', 'public.hmrc_integrations', 'SELECT'), 'old hmrc_integrations: no client access (no token writes)');
  PERFORM pg_temp.ok((SELECT client_id IS NULL AND client_secret IS NULL AND redirect_uri IS NULL FROM public.hmrc_settings)
                     AND NOT has_column_privilege('authenticated', 'public.hmrc_settings', 'client_secret', 'SELECT')
                     AND NOT has_column_privilege('authenticated', 'public.hmrc_settings', 'client_id', 'SELECT')
                     AND NOT has_column_privilege('authenticated', 'public.hmrc_settings', 'client_id', 'INSERT')
                     AND NOT has_column_privilege('authenticated', 'public.hmrc_settings', 'redirect_uri', 'UPDATE')
                     AND (SELECT company_name FROM public.hmrc_settings) = 'Test Ltd', 'hmrc_settings: per-user credentials cleared and blocked; business details kept');
END $$;
SELECT pg_temp.fails($$UPDATE public.hmrc_settings SET client_secret = 'x'$$, 'hmrc_settings_no_credentials', 'even the service side cannot store a client secret again');

\echo '== hmrc_settings business details still editable by their owner'
SELECT pg_temp.who(1); SET ROLE authenticated;
DO $$ BEGIN
  INSERT INTO public.hmrc_settings (user_id, company_name, vat_number) VALUES (pg_temp.u(1), 'A Ltd', 'GB000000000');
  UPDATE public.hmrc_settings SET company_name = 'A Limited' WHERE user_id = pg_temp.u(1);
  PERFORM pg_temp.ok((SELECT company_name FROM public.hmrc_settings) = 'A Limited', 'owner saves and edits their business details; sees only their own row');
END $$;
SELECT pg_temp.fails($$UPDATE public.hmrc_settings SET client_id = 'x' WHERE user_id = pg_temp.u(1)$$, 'permission denied', 'cannot write a client id');
SELECT pg_temp.fails($$SELECT client_secret FROM public.hmrc_settings$$, 'permission denied', 'cannot read a client secret');
SELECT pg_temp.fails($$SELECT access_token FROM public.hmrc_integrations$$, 'permission denied', 'cannot read old tokens');
SELECT pg_temp.fails($$INSERT INTO public.hmrc_integrations (user_id, access_token) VALUES (pg_temp.u(1), 'planted')$$, 'permission denied', 'cannot plant old tokens');
SELECT pg_temp.fails($$SELECT * FROM public.hmrc_connections$$, 'permission denied', 'cannot read hmrc_connections');
SELECT pg_temp.fails($$SELECT * FROM public.hmrc_oauth_states$$, 'permission denied', 'cannot read sign-in states');
SELECT pg_temp.fails($$SELECT * FROM public.hmrc_audit_log$$, 'permission denied', 'cannot read the audit table directly');
SELECT pg_temp.fails($$SELECT public.hmrc_manage_allowed(pg_temp.o(1), pg_temp.u(1))$$, 'permission denied', 'cannot call the service-only rule');
SELECT pg_temp.fails($$SELECT * FROM public.hmrc_consume_state(repeat('a', 64), pg_temp.u(1))$$, 'permission denied', 'cannot consume states');
SELECT pg_temp.fails($$SELECT public.hmrc_claim_refresh(pg_temp.o(1), 'sandbox')$$, 'permission denied', 'cannot take the refresh lock');
SELECT pg_temp.fails($$SELECT public.get_hmrc_tokens(pg_temp.u(1))$$, 'does not exist', 'get_hmrc_tokens is gone');
RESET ROLE; RESET request.jwt.claims;

\echo '== the rule (as the Edge Functions call it)'
SET ROLE service_role;
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT string_agg(n || '=' || public.hmrc_manage_allowed(pg_temp.o(1), pg_temp.u(n)), ' ' ORDER BY n) FROM unnest(ARRAY[1,2,3,4,5,6,8,9,11]) n)
                     = '1=ok 2=ok 3=not_admin 4=not_member 5=not_member 6=not_member 8=suspended 9=ok 11=not_member',
                     'company A: owner, admin ok; member not admin; super admin, master account and another company''s owner are not members; suspended refused');
  PERFORM pg_temp.ok(public.hmrc_manage_allowed(pg_temp.o(3), pg_temp.u(7)) = 'trial_ended', 'trial ended: refused');
  PERFORM pg_temp.ok(public.hmrc_manage_allowed(pg_temp.o(4), pg_temp.u(10)) = 'ok', 'on the 14-day trial: allowed');
  PERFORM pg_temp.ok(public.hmrc_manage_allowed(pg_temp.o(2), pg_temp.u(6)) = 'ok' AND public.hmrc_manage_allowed(pg_temp.o(1), NULL) = 'not_signed_in', 'company B owner manages only B; no user: refused');
END $$;
-- A connection for company A, as hmrc-connect-complete stores it (ciphertext format only; this is not a real token).
INSERT INTO public.hmrc_connections (company_id, environment, connected_by, access_token_enc, refresh_token_enc, expires_at, scopes, status, connected_at)
VALUES (pg_temp.o(1), 'sandbox', pg_temp.u(1), 'v1.AbC123xy.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBBBBBBBB', 'v1.AbC123xy.CCCCCCCCCCCCCCCC.DDDDDDDDDDDDDDDDDDDDDDDDDDDD',
        now() + interval '4 hours', ARRAY['read:vat', 'write:vat'], 'connected', now());
INSERT INTO public.hmrc_audit_log (company_id, user_id, environment, event) VALUES (pg_temp.o(1), pg_temp.u(1), 'sandbox', 'connected');
RESET ROLE;
SELECT pg_temp.fails($$INSERT INTO public.hmrc_connections (company_id, environment, access_token_enc, status) VALUES (pg_temp.o(2), 'sandbox', 'plain-token', 'connected')$$,
                     'hc_access_format', 'a plain token can never be stored (ciphertext format only)');
SELECT pg_temp.fails($$INSERT INTO public.hmrc_connections (company_id, environment, access_token_enc, status) VALUES (pg_temp.o(2), 'sandbox', 'v1.k.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBBBB', 'disconnected')$$,
                     'hc_disconnected_no_tokens', 'disconnected keeps no tokens');
SELECT pg_temp.fails($$INSERT INTO public.hmrc_connections (company_id, environment, status) VALUES (pg_temp.o(1), 'sandbox', 'needs_reconnect')$$,
                     'hc_one_per_company', 'one connection per company and environment');
SELECT pg_temp.fails($$INSERT INTO public.hmrc_connections (company_id, environment, status) VALUES (pg_temp.o(2), 'live', 'needs_reconnect')$$, 'hc_environment', 'environment is sandbox or production');

\echo '== status: never a token; members read-only; non-members (platform admins included) nothing'
SELECT pg_temp.who(1); SET ROLE authenticated;
DO $$ DECLARE j json; BEGIN
  j := public.hmrc_connection_status(pg_temp.o(1));
  PERFORM pg_temp.ok((j ->> 'can_manage')::boolean AND j ->> 'access' = 'ok' AND (j -> 'connections' -> 0 ->> 'status') = 'connected'
                     AND (j -> 'connections' -> 0 ->> 'environment') = 'sandbox' AND (j -> 'connections' -> 0 ->> 'connected_by_name') = 'Person 1',
                     'owner: status, environment, who connected; can manage');
  PERFORM pg_temp.ok(j::text !~ 'v1\.' AND j::text !~ 'token' AND j::text !~ 'AAAAAAAA', 'status carries no token, ciphertext or key id');
  PERFORM pg_temp.ok((SELECT array_agg(k ORDER BY k) FROM json_object_keys(j -> 'connections' -> 0) k)
                     = ARRAY['connected_at','connected_by_name','environment','expires_at','needs_reconnect','scopes','status','updated_at'], 'status keys: exactly the safe ones');
  PERFORM pg_temp.ok(public.hmrc_can_manage(pg_temp.o(1)) AND NOT public.hmrc_can_manage(pg_temp.o(2)), 'owner can manage A, not B');
  PERFORM pg_temp.ok(json_array_length(public.hmrc_audit_events(pg_temp.o(1))) = 1 AND (public.hmrc_audit_events(pg_temp.o(1)) -> 0 ->> 'event') = 'connected',
                     'owner reads the company audit trail');
END $$;
RESET ROLE;
SELECT pg_temp.who(2); SET ROLE authenticated;
DO $$ BEGIN PERFORM pg_temp.ok((public.hmrc_connection_status(pg_temp.o(1)) ->> 'can_manage')::boolean, 'admin: can manage'); END $$;
RESET ROLE;
SELECT pg_temp.who(3); SET ROLE authenticated;
DO $$ DECLARE j json; BEGIN
  j := public.hmrc_connection_status(pg_temp.o(1));
  PERFORM pg_temp.ok(NOT (j ->> 'can_manage')::boolean AND (j -> 'connections' -> 0 ->> 'status') = 'connected', 'member: sees the status only, cannot manage');
  PERFORM pg_temp.ok(NOT public.hmrc_can_manage(pg_temp.o(1)), 'member: hmrc_can_manage false');
END $$;
SELECT pg_temp.fails($$SELECT public.hmrc_audit_events(pg_temp.o(1))$$, 'HMRC_NOT_ALLOWED', 'member: no audit trail');
RESET ROLE;
DO $$ DECLARE n int; BEGIN
  FOREACH n IN ARRAY ARRAY[4, 5, 6, 11] LOOP
    PERFORM pg_temp.who(n); SET LOCAL ROLE authenticated;
    BEGIN
      PERFORM public.hmrc_connection_status(pg_temp.o(1));
      RAISE EXCEPTION 'FAIL|person % saw company A status', n;
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN
      PERFORM public.hmrc_audit_events(pg_temp.o(1));
      RAISE EXCEPTION 'FAIL|person % saw company A audit', n;
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    PERFORM pg_temp.ok(NOT public.hmrc_can_manage(pg_temp.o(1)), 'not a member of A (person ' || n || '): nothing visible, cannot manage');
    RESET ROLE;
  END LOOP;
END $$;
RESET request.jwt.claims;
DO $$ BEGIN PERFORM pg_temp.ok(true, 'super admin (4), master account (5), other company''s owner (6), outsider (11): HMRC_NOT_ALLOWED for status and audit'); END $$;
SELECT pg_temp.who(7); SET ROLE authenticated;
DO $$ BEGIN PERFORM pg_temp.ok(public.hmrc_connection_status(pg_temp.o(3)) ->> 'access' = 'trial_ended' AND NOT public.hmrc_can_manage(pg_temp.o(3)), 'trial ended: told so, cannot manage'); END $$;
RESET ROLE;
SELECT pg_temp.who(8); SET ROLE authenticated;
DO $$ DECLARE j json; BEGIN
  j := public.hmrc_connection_status(pg_temp.o(1));
  PERFORM pg_temp.ok(j ->> 'access' = 'suspended' AND json_array_length(j -> 'connections') = 0 AND NOT public.hmrc_can_manage(pg_temp.o(1)), 'suspended: told so, no details, cannot manage');
END $$;
RESET ROLE;
SELECT pg_temp.who(9); SET ROLE authenticated;
SELECT pg_temp.fails($$SELECT public.hmrc_connection_status(pg_temp.o(1))$$, 'MFA_REQUIRED', 'two-step set up, code not entered: refused');
SELECT pg_temp.fails($$SELECT public.hmrc_can_manage(pg_temp.o(1))$$, 'MFA_REQUIRED', 'two-step set up, code not entered: can_manage refused');
RESET ROLE;
SELECT pg_temp.who(9, 'aal2'); SET ROLE authenticated;
DO $$ BEGIN PERFORM pg_temp.ok((public.hmrc_connection_status(pg_temp.o(1)) ->> 'can_manage')::boolean, 'with the code (aal2): works'); END $$;
RESET ROLE; RESET request.jwt.claims;
SET ROLE anon;
SELECT pg_temp.fails($$SELECT public.hmrc_connection_status(pg_temp.o(1))$$, 'permission denied', 'anon: status refused');
SELECT pg_temp.fails($$SELECT public.hmrc_can_manage(pg_temp.o(1))$$, 'permission denied', 'anon: can_manage refused');
SELECT pg_temp.fails($$SELECT * FROM public.hmrc_connections$$, 'permission denied', 'anon: no table');
RESET ROLE;

\echo '== sign-in states: single use, 10 minutes, same user'
SET ROLE service_role;
DO $$ DECLARE r record; BEGIN
  INSERT INTO public.hmrc_oauth_states (state_hash, user_id, company_id, environment) VALUES (repeat('a', 64), pg_temp.u(1), pg_temp.o(1), 'sandbox');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.hmrc_consume_state(repeat('a', 64), pg_temp.u(2))), 'another user cannot use it');
  SELECT * INTO r FROM public.hmrc_consume_state(repeat('a', 64), pg_temp.u(1));
  PERFORM pg_temp.ok(r.company_id = pg_temp.o(1) AND r.environment = 'sandbox', 'used once: returns the company and environment');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.hmrc_consume_state(repeat('a', 64), pg_temp.u(1))), 'second use refused');
  INSERT INTO public.hmrc_oauth_states (state_hash, user_id, company_id, environment, created_at, expires_at)
  VALUES (repeat('b', 64), pg_temp.u(1), pg_temp.o(1), 'sandbox', now() - interval '20 minutes', now() - interval '11 minutes');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.hmrc_consume_state(repeat('b', 64), pg_temp.u(1))), 'expired state refused');
END $$;
SELECT pg_temp.fails($$INSERT INTO public.hmrc_oauth_states (state_hash, user_id, company_id, environment, expires_at) VALUES (repeat('c', 64), pg_temp.u(1), pg_temp.o(1), 'sandbox', now() + interval '11 minutes')$$,
                     'hos_ten_minutes', 'a state can live 10 minutes at most');
SELECT pg_temp.fails($$INSERT INTO public.hmrc_oauth_states (state_hash, user_id, company_id, environment) VALUES ('raw-state-value', pg_temp.u(1), pg_temp.o(1), 'sandbox')$$,
                     'hos_hash', 'only a SHA-256 hash is stored');

\echo '== refresh lock: one at a time'
DO $$ BEGIN
  PERFORM pg_temp.ok(public.hmrc_claim_refresh(pg_temp.o(1), 'sandbox'), 'first caller takes the lock');
  PERFORM pg_temp.ok(NOT public.hmrc_claim_refresh(pg_temp.o(1), 'sandbox'), 'a second caller does not');
  UPDATE public.hmrc_connections SET refresh_lock_until = now() - interval '1 second' WHERE company_id = pg_temp.o(1);
  PERFORM pg_temp.ok(public.hmrc_claim_refresh(pg_temp.o(1), 'sandbox'), 'after the lock runs out it can be taken again');
  PERFORM pg_temp.ok(NOT public.hmrc_claim_refresh(pg_temp.o(2), 'sandbox'), 'no connection: no lock');
END $$;

\echo '== audit log: append-only for everyone'
SELECT pg_temp.fails($$UPDATE public.hmrc_audit_log SET event = 'refused'$$, 'permission denied', 'service role: no UPDATE');
SELECT pg_temp.fails($$DELETE FROM public.hmrc_audit_log$$, 'permission denied', 'service role: no DELETE');
DO $$ BEGIN
  INSERT INTO public.hmrc_audit_log (company_id, user_id, environment, event, reason, created_at)
  VALUES (pg_temp.o(1), pg_temp.u(3), 'sandbox', 'refused', 'not_admin', now() - interval '1 year');
  PERFORM pg_temp.ok((SELECT created_at > now() - interval '1 minute' FROM public.hmrc_audit_log WHERE reason = 'not_admin'), 'created_at from the server clock');
END $$;
SELECT pg_temp.fails($$INSERT INTO public.hmrc_audit_log (company_id, event, reason) VALUES (pg_temp.o(1), 'refused', 'Bearer abc.def')$$, 'hal_reason', 'reason is a short code only (no free text, so no token can be written)');
RESET ROLE;
SELECT pg_temp.fails($$UPDATE public.hmrc_audit_log SET event = 'refused'$$, 'HMRC_AUDIT_APPEND_ONLY', 'even the database owner cannot change a row');
SELECT pg_temp.fails($$DELETE FROM public.hmrc_audit_log$$, 'HMRC_AUDIT_APPEND_ONLY', 'even the database owner cannot delete a row');
SELECT pg_temp.fails($$TRUNCATE public.hmrc_audit_log$$, 'HMRC_AUDIT_APPEND_ONLY', 'TRUNCATE is refused');
