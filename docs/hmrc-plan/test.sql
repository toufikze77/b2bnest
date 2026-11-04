-- HMRC plan rule tests (DISPOSABLE local Postgres only). Run by docs/hmrc-plan/run-test.sh after the shim, the Phase 35 /
-- 36 / 37 / 31 fixtures, docs/hmrc-p0/fixture.sql and docs/hmrc-p0/proposal.sql (production as of 4 Nov 2026).
\set ON_ERROR_STOP 1
\i docs/phase37/test-helpers.sql

-- People (e2…0NN) and companies (0e2…00N):
--  O1 paid by 1 on Business: 1 owner, 2 admin, 3 member, 10 suspended admin.
--  O2 paid by 4 on Solo: 4 owner, 5 member, 6 admin, 15 master account who is also an admin of O2.
--  O3 paid by 7 on Scale: 7 owner.   O4: 8 owner on the trial.   O5: 9 owner whose trial ended.
--  O6: 11 owner with no subscribers row and no trial.   O7: 12 owner paying with no plan key (fails closed).
--  13 super admin and 14 master account, in no company.
INSERT INTO auth.users (id, email) SELECT ('e2000000-0000-4000-8000-0000000000' || lpad(x::text, 2, '0'))::uuid, 'q' || x || '@example.test' FROM generate_series(1, 15) x;
INSERT INTO public.profiles (id, email, full_name, trial_ends_at, is_active)
SELECT ('e2000000-0000-4000-8000-0000000000' || lpad(x::text, 2, '0'))::uuid, 'q' || x || '@example.test', 'Person ' || x,
       CASE WHEN x = 8 THEN now() + interval '5 days' WHEN x = 9 THEN now() - interval '2 days' END, x <> 10
  FROM generate_series(1, 15) x;
INSERT INTO public.subscribers (user_id, email, subscribed, subscription_status, plan_key) VALUES
  ('e2000000-0000-4000-8000-000000000001', 'q1@example.test', true, 'active', 'professional'),
  ('e2000000-0000-4000-8000-000000000004', 'q4@example.test', true, 'active', 'starter'),
  ('e2000000-0000-4000-8000-000000000007', 'q7@example.test', true, 'active', 'enterprise'),
  ('e2000000-0000-4000-8000-000000000012', 'q12@example.test', true, 'active', NULL);
INSERT INTO public.user_roles (user_id, role) VALUES ('e2000000-0000-4000-8000-000000000013', 'super_admin');
INSERT INTO public.master_access (user_id, note) VALUES ('e2000000-0000-4000-8000-000000000014', 'testing'), ('e2000000-0000-4000-8000-000000000015', 'testing');
INSERT INTO public.organizations (id, name, created_by)
SELECT ('0e200000-0000-4000-8000-00000000000' || x)::uuid, 'Company ' || x, ('e2000000-0000-4000-8000-0000000000' || lpad(o::text, 2, '0'))::uuid
  FROM (VALUES (1, 1), (2, 4), (3, 7), (4, 8), (5, 9), (6, 11), (7, 12)) v(x, o);
INSERT INTO public.organization_members (organization_id, user_id, role)
SELECT ('0e200000-0000-4000-8000-00000000000' || c)::uuid, ('e2000000-0000-4000-8000-0000000000' || lpad(u::text, 2, '0'))::uuid, r
  FROM (VALUES (1, 1, 'owner'), (1, 2, 'admin'), (1, 3, 'member'), (1, 10, 'admin'), (2, 4, 'owner'), (2, 5, 'member'), (2, 6, 'admin'), (2, 15, 'admin'),
               (3, 7, 'owner'), (4, 8, 'owner'), (5, 9, 'owner'), (6, 11, 'owner'), (7, 12, 'owner')) v(c, u, r);
INSERT INTO public.organization_billing (organization_id, billing_user_id)
SELECT ('0e200000-0000-4000-8000-00000000000' || x)::uuid, ('e2000000-0000-4000-8000-0000000000' || lpad(o::text, 2, '0'))::uuid
  FROM (VALUES (1, 1), (2, 4), (3, 7), (4, 8), (5, 9), (6, 11), (7, 12)) v(x, o);

CREATE FUNCTION pg_temp.who(n int) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', 'e2000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'), 'role', 'authenticated', 'aal', 'aal1')::text, false) $$;
CREATE FUNCTION pg_temp.u(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('e2000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid $$;
CREATE FUNCTION pg_temp.o(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('0e200000-0000-4000-8000-00000000000' || n)::uuid $$;
GRANT EXECUTE ON FUNCTION pg_temp.who(int), pg_temp.u(int), pg_temp.o(int) TO PUBLIC;
-- (person, company) pairs for the matrix
CREATE TABLE public.t_matrix (n int, c int, label text, want text);
INSERT INTO public.t_matrix VALUES
  (1, 1, 'Business owner', 'ok'), (2, 1, 'admin of a Business company (via the owner''s plan)', 'ok'), (3, 1, 'member of a Business company', 'not_admin'),
  (10, 1, 'suspended admin', 'suspended'), (4, 2, 'Solo owner', 'plan_not_included'), (5, 2, 'member of a Solo company', 'plan_not_included'),
  (6, 2, 'admin of a Solo company (via the owner''s plan)', 'plan_not_included'), (15, 2, 'master account who is an admin of a Solo company', 'ok'),
  (7, 3, 'Scale owner', 'ok'), (8, 4, 'owner on the 14-day trial', 'ok'), (9, 5, 'owner whose trial ended', 'trial_ended'),
  (11, 6, 'owner with no plan row and no trial', 'trial_ended'), (12, 7, 'owner paying with no plan key', 'plan_not_included'),
  (13, 1, 'super admin not in the company', 'not_member'), (14, 1, 'master account not in the company', 'not_member'),
  (7, 1, 'another company''s owner', 'not_member');
GRANT SELECT ON public.t_matrix TO PUBLIC;

\echo '== before: Solo owners and admins are allowed (HMRC P0)'
SET ROLE service_role;
DO $$ BEGIN PERFORM pg_temp.ok(public.hmrc_manage_allowed(pg_temp.o(2), pg_temp.u(4)) = 'ok', 'before: a Solo owner may manage HMRC (the gap this closes)'); END $$;
RESET ROLE;

\echo '== apply'
\i docs/hmrc-plan/proposal.sql
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT string_agg(x, ',' ORDER BY x) FROM unnest((SELECT proacl::text[] FROM pg_proc WHERE oid = 'public.hmrc_manage_allowed(uuid,uuid)'::regprocedure)) x)
                     = 'postgres=X/postgres,service_role=X/postgres' AND NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.hmrc_manage_allowed(uuid,uuid)'::regprocedure),
                     'hmrc_manage_allowed: still service role only, SECURITY INVOKER, search_path pinned');
  PERFORM pg_temp.ok((SELECT string_agg(x, ',' ORDER BY x) FROM unnest((SELECT proacl::text[] FROM pg_proc WHERE oid = 'public.hmrc_connection_status(uuid)'::regprocedure)) x)
                     = 'authenticated=X/postgres,postgres=X/postgres' AND (SELECT prosecdef AND proconfig @> ARRAY['search_path=""'] FROM pg_proc WHERE oid = 'public.hmrc_connection_status(uuid)'::regprocedure),
                     'hmrc_connection_status: authenticated only, SECURITY DEFINER, search_path pinned');
  PERFORM pg_temp.ok((SELECT md5(p.prosrc) = g.new_md5 AND md5(replace(p.prosrc, E'\n  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard', '')) = g.old_md5
                        FROM pg_proc p, public.phase25_mfa_guard_log g WHERE p.oid = 'public.hmrc_connection_status(uuid)'::regprocedure AND g.fn = 'public.hmrc_connection_status(uuid)'),
                     'hmrc_connection_status: guard line kept, guard log row matches the new body');
  PERFORM pg_temp.ok((SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.hmrc_can_manage(uuid)'::regprocedure) = '1d40a67edbcea7a53e09f9acb986630f'
                     AND (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.hmrc_audit_events(uuid,integer)'::regprocedure) = '47b3d4d71f94b27c947a4f6e007bc182',
                     'hmrc_can_manage and hmrc_audit_events unchanged');
END $$;

\echo '== the matrix: hmrc_manage_allowed (as the Edge Functions call it)'
SET ROLE service_role;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT * FROM public.t_matrix LOOP
    PERFORM pg_temp.ok(public.hmrc_manage_allowed(pg_temp.o(r.c), pg_temp.u(r.n)) = r.want, 'manage_allowed: ' || r.label || ' = ' || r.want);
  END LOOP;
  PERFORM pg_temp.ok(public.hmrc_manage_allowed(pg_temp.o(1), NULL) = 'not_signed_in', 'manage_allowed: nobody = not_signed_in');
END $$;
RESET ROLE;

\echo '== the matrix: hmrc_can_manage, hmrc_connection_status, hmrc_audit_events (as the person)'
DO $$ DECLARE r record; j json; denied boolean; BEGIN
  FOR r IN SELECT * FROM public.t_matrix LOOP
    PERFORM pg_temp.who(r.n);
    SET LOCAL ROLE authenticated;
    PERFORM pg_temp.ok(public.hmrc_can_manage(pg_temp.o(r.c)) = (r.want = 'ok'), 'can_manage: ' || r.label || ' = ' || (r.want = 'ok'));
    BEGIN
      j := public.hmrc_connection_status(pg_temp.o(r.c)); denied := false;
    EXCEPTION WHEN insufficient_privilege THEN denied := true; END;
    IF r.want = 'not_member' THEN
      PERFORM pg_temp.ok(denied, 'status: ' || r.label || ' = HMRC_NOT_ALLOWED');
    ELSIF r.want IN ('plan_not_included', 'trial_ended', 'suspended') THEN
      PERFORM pg_temp.ok(NOT denied AND j::text = json_build_object('access', r.want, 'can_manage', false, 'connections', '[]'::json)::text,
                         'status: ' || r.label || ' = {access:' || r.want || ', can_manage:false, connections:[]} and nothing else');
    ELSE
      PERFORM pg_temp.ok(NOT denied AND j ->> 'access' = 'ok' AND (j ->> 'can_manage')::boolean = (r.want = 'ok'), 'status: ' || r.label || ' = ok, can_manage ' || (r.want = 'ok'));
    END IF;
    BEGIN
      PERFORM public.hmrc_audit_events(pg_temp.o(r.c)); denied := false;
    EXCEPTION WHEN insufficient_privilege THEN denied := true; END;
    PERFORM pg_temp.ok(denied = (r.want <> 'ok'), 'audit: ' || r.label || CASE WHEN r.want = 'ok' THEN ' reads it' ELSE ' refused' END);
    RESET ROLE;
  END LOOP;
END $$;
RESET request.jwt.claims;
SET ROLE anon;
SELECT pg_temp.fails($$SELECT public.hmrc_connection_status(pg_temp.o(1))$$, 'permission denied', 'anon: status refused');
SELECT pg_temp.fails($$SELECT public.hmrc_can_manage(pg_temp.o(1))$$, 'permission denied', 'anon: can_manage refused');
SELECT pg_temp.fails($$SELECT public.hmrc_audit_events(pg_temp.o(1))$$, 'permission denied', 'anon: audit refused');
SELECT pg_temp.fails($$SELECT public.hmrc_manage_allowed(pg_temp.o(1), pg_temp.u(1))$$, 'permission denied', 'anon: the rule itself refused');
RESET ROLE;
SELECT pg_temp.who(1); SET ROLE authenticated;
SELECT pg_temp.fails($$SELECT public.hmrc_manage_allowed(pg_temp.o(1), pg_temp.u(1))$$, 'permission denied', 'authenticated: cannot call the service-only rule');
RESET ROLE; RESET request.jwt.claims;
DROP TABLE public.t_matrix;
