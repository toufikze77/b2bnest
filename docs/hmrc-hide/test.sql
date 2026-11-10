-- HMRC hide switch tests (DISPOSABLE local Postgres only). Run by docs/hmrc-hide/run-test.sh after production's shape,
-- docs/hmrc-hide/fixture.sql and docs/hmrc-hide/proposal.sql. One transaction, rolled back. Fictional people only.
-- S: platform super admin. A: platform admin. U: an ordinary customer (a company owner). M: the demo account.
\set ON_ERROR_STOP 1
BEGIN;
\i docs/phase37/test-helpers.sql
INSERT INTO auth.users (id, email) VALUES
  ('fe000000-0000-4000-8000-0000000000a5', 's@example.test'), ('fe000000-0000-4000-8000-0000000000a1', 'a@example.test'),
  ('fe000000-0000-4000-8000-0000000000c1', 'u@example.test'), ('fe000000-0000-4000-8000-0000000000e6', 'm@example.test');
INSERT INTO public.profiles (id, email) SELECT id, email FROM auth.users WHERE id::text LIKE 'fe000000%' ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_roles (user_id, role) VALUES ('fe000000-0000-4000-8000-0000000000a5', 'super_admin'), ('fe000000-0000-4000-8000-0000000000a1', 'admin'),
  ('fe000000-0000-4000-8000-0000000000c1', 'user');
INSERT INTO public.demo_readonly_users (user_id) VALUES ('fe000000-0000-4000-8000-0000000000e6');
CREATE FUNCTION pg_temp.as_user(u text, aal text DEFAULT 'aal1') RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated', 'aal', aal)::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.as_user(text, text) TO PUBLIC;

\echo '== seeded hidden; every signed-in person reads that one key only'
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT value FROM public.platform_settings WHERE key = 'hmrc_customer_access') = '"hidden"'::jsonb, 'the switch is seeded hidden');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.platform_settings) = 4, 'the other three settings are untouched');
END $$;
SELECT pg_temp.as_user('fe000000-0000-4000-8000-0000000000c1');
SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT array_agg(key) FROM public.platform_settings) = ARRAY['hmrc_customer_access'], 'a customer reads the HMRC key and nothing else');
  PERFORM pg_temp.ok((SELECT value FROM public.platform_settings WHERE key = 'hmrc_customer_access') = '"hidden"'::jsonb, 'and sees hidden');
  UPDATE public.platform_settings SET value = '"visible"' WHERE key = 'hmrc_customer_access';
  PERFORM pg_temp.fails($q$INSERT INTO public.platform_settings (key, value) VALUES ('hmrc_customer_access_2', '"visible"')$q$, 'row-level security', 'a customer cannot add a setting');
  DELETE FROM public.platform_settings WHERE key = 'hmrc_customer_access';
  PERFORM pg_temp.fails($q$SELECT public.hmrc_set_customer_access('visible')$q$, 'Not authorized', 'a customer cannot flip the switch');
  PERFORM pg_temp.fails($q$SELECT * FROM public.hmrc_customer_access_status()$q$, 'Not authorized', 'a customer cannot read who changed it');
  PERFORM pg_temp.fails($q$INSERT INTO public.user_roles (user_id, role) VALUES ('fe000000-0000-4000-8000-0000000000c1', 'admin')$q$, 'row-level security',
    'a customer cannot give themselves the platform admin role');
  PERFORM pg_temp.fails($q$INSERT INTO public.user_roles (user_id, role) VALUES ('fe000000-0000-4000-8000-0000000000c1', 'super_admin')$q$, 'super_admin cannot be assigned',
    'nor super admin');
END $$;
RESET ROLE;
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT value FROM public.platform_settings WHERE key = 'hmrc_customer_access') = '"hidden"'::jsonb, 'the customer''s update and delete changed nothing (RLS)');
END $$;

SELECT pg_temp.as_user('fe000000-0000-4000-8000-0000000000a1', 'aal2');
SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT array_agg(key) FROM public.platform_settings) = ARRAY['hmrc_customer_access'], 'a platform admin (not super) also reads only the HMRC key');
  PERFORM pg_temp.fails($q$SELECT public.hmrc_set_customer_access('visible')$q$, 'Not authorized', 'a platform admin cannot flip the switch (super admins only)');
END $$;
RESET ROLE;

\echo '== anon reads nothing and cannot call either function'
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SET ROLE anon;
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT count(*) FROM public.platform_settings) = 0, 'anon reads no setting, not even the HMRC key');
  PERFORM pg_temp.fails($q$SELECT public.hmrc_set_customer_access('visible')$q$, 'permission denied', 'anon cannot flip the switch');
  PERFORM pg_temp.fails($q$SELECT * FROM public.hmrc_customer_access_status()$q$, 'permission denied', 'anon cannot read the status');
END $$;
RESET ROLE;

\echo '== super admin: two-step sign-in needed; then flips, audited, with who and when'
SELECT pg_temp.as_user('fe000000-0000-4000-8000-0000000000a5', 'aal1');
SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.fails($q$SELECT public.hmrc_set_customer_access('visible')$q$, 'MFA_REQUIRED', 'a super admin without two-step sign-in is refused');
END $$;
RESET ROLE;
SELECT pg_temp.as_user('fe000000-0000-4000-8000-0000000000a5', 'aal2');
SET ROLE authenticated;
DO $$ DECLARE s record; BEGIN
  PERFORM pg_temp.ok(public.hmrc_set_customer_access('visible') = 'visible', 'a super admin shows HMRC to customers');
  SELECT * INTO s FROM public.hmrc_customer_access_status();
  PERFORM pg_temp.ok(s.state = 'visible' AND s.updated_by_email = 's@example.test' AND s.updated_at IS NOT NULL, 'the status says visible, who and when');
  PERFORM pg_temp.ok(public.hmrc_set_customer_access('hidden') = 'hidden', 'and hides it again');
  PERFORM pg_temp.fails($q$SELECT public.hmrc_set_customer_access('production')$q$, 'HMRC_ACCESS_STATE', 'only visible or hidden');
  PERFORM pg_temp.fails($q$SELECT public.hmrc_set_customer_access(NULL)$q$, 'HMRC_ACCESS_STATE', 'no empty state');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.platform_settings) = 4, 'a super admin still reads every setting (existing policy)');
END $$;
RESET ROLE;
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT count(*) FROM public.admin_audit_logs WHERE action = 'settings.hmrc_customer_access' AND admin_id = 'fe000000-0000-4000-8000-0000000000a5') = 2,
    'each flip writes an admin audit entry');
  PERFORM pg_temp.ok((SELECT details->>'state' FROM public.admin_audit_logs WHERE action = 'settings.hmrc_customer_access' ORDER BY created_at DESC, details->>'state' LIMIT 1) IN ('hidden', 'visible'),
    'the audit entry holds the state');
  PERFORM pg_temp.ok((SELECT value FROM public.platform_settings WHERE key = 'hmrc_customer_access') = '"hidden"'::jsonb
    AND (SELECT updated_by FROM public.platform_settings WHERE key = 'hmrc_customer_access') = 'fe000000-0000-4000-8000-0000000000a5', 'the row records who changed it');
END $$;

\echo '== the demo account is refused by the demo guard'
SELECT pg_temp.as_user('fe000000-0000-4000-8000-0000000000e6', 'aal2');
SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.fails($q$SELECT public.hmrc_set_customer_access('visible')$q$, 'Not authorized', 'the demo account cannot flip the switch');
END $$;
RESET ROLE;
ROLLBACK;
