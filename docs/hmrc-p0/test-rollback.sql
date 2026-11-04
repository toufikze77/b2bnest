-- HMRC P0 rollback tests (run after test.sql and after rollback.sql was refused without force).
\set ON_ERROR_STOP 1
\i docs/phase37/test-helpers.sql
SET app.hmrc_p0_force = 'on';
\i docs/hmrc-p0/rollback.sql
RESET app.hmrc_p0_force;
DO $$ BEGIN
  PERFORM pg_temp.ok(t0.fingerprint() = (SELECT fp FROM t0.before), 'forced rollback: functions, privileges, column grants, triggers, constraints and guard log exactly as before');
  PERFORM pg_temp.ok(to_regclass('public.hmrc_connections') IS NULL AND to_regclass('public.hmrc_p0_backup') IS NULL AND to_regprocedure('public.hmrc_connection_status(uuid)') IS NULL,
                     'forced rollback: HMRC P0 objects removed');
  PERFORM pg_temp.ok((SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.get_hmrc_tokens(uuid)'::regprocedure) = '5532c89e3e0c944bca121522b6dbbc06', 'forced rollback: old functions back byte for byte');
  PERFORM pg_temp.ok((SELECT client_secret = '' AND company_name = 'Test Ltd' FROM public.hmrc_settings WHERE user_id = 'a0000000-0000-4000-8000-0000000000ff'),
                     'forced rollback: the cleared credential is not restored (empty), business details kept');
END $$;
\echo '== apply again'
DELETE FROM public.hmrc_settings WHERE user_id <> 'a0000000-0000-4000-8000-0000000000ff';  -- the test row added above; production had one
\i docs/hmrc-p0/proposal.sql
DO $$ BEGIN
  PERFORM pg_temp.ok(to_regclass('public.hmrc_connections') IS NOT NULL AND (SELECT count(*) FROM public.phase25_mfa_guard_log WHERE fn ~ '^public\.hmrc_') = 3, 're-apply after rollback works');
END $$;
