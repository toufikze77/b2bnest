-- HMRC plan rule rollback tests.
\set ON_ERROR_STOP 1
\i docs/phase37/test-helpers.sql
\i docs/hmrc-plan/rollback.sql
DO $$ BEGIN
  PERFORM pg_temp.ok(t1.fingerprint() = (SELECT fp FROM t1.before), 'rollback: every function body, privilege and guard log row exactly as HMRC P0');
  PERFORM pg_temp.ok((SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.hmrc_manage_allowed(uuid,uuid)'::regprocedure) = '9da6644ed17385ccb8c0d184e206ccab'
                     AND (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.hmrc_connection_status(uuid)'::regprocedure) = '588c2a91667fb727284ad0c72608274d',
                     'rollback: the HMRC P0 bodies are back');
END $$;
\echo '== apply again'
\i docs/hmrc-plan/proposal.sql
DO $$ BEGIN PERFORM pg_temp.ok(position('plan_not_included' in (SELECT prosrc FROM pg_proc WHERE oid = 'public.hmrc_manage_allowed(uuid,uuid)'::regprocedure)) > 0, 're-apply after rollback works'); END $$;
