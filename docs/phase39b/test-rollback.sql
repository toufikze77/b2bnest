-- Phase 39b rollback tests.
\set ON_ERROR_STOP 1
\i docs/phase37/test-helpers.sql
CREATE TEMP TABLE t_rows AS SELECT count(*) AS n FROM public.marketing_consents;
\i docs/phase39b/rollback.sql
DO $$ BEGIN
  PERFORM pg_temp.ok(t39b.fingerprint() = (SELECT fp FROM t39b.before), 'rollback: function body, privileges and guard log row exactly as Phase 39');
  PERFORM pg_temp.ok((SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.marketing_consent_record_signup()'::regprocedure) = '92b26481e8c7b688d055bde1c0360953',
                     'rollback: the Phase 39 body is back');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.marketing_consents) = (SELECT n FROM t_rows), 'rollback: no consent row removed');
END $$;
\echo '== apply again'
\i docs/phase39b/proposal.sql
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.marketing_consent_record_signup()'::regprocedure)
                     = (SELECT new_md5 FROM public.phase25_mfa_guard_log WHERE fn = 'public.marketing_consent_record_signup()')
                     AND (SELECT new_md5 FROM public.phase25_mfa_guard_log WHERE fn = 'public.marketing_consent_record_signup()') <> '92b26481e8c7b688d055bde1c0360953',
                     're-apply after rollback works');
END $$;
