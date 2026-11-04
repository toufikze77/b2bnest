-- =====================================================================================================================
-- HMRC P0 rollback (one transaction). Removes hmrc_connections, hmrc_oauth_states, hmrc_audit_log and the new functions,
-- and puts back exactly what HMRC P0 replaced: the five old functions (bodies and privileges, from public.hmrc_p0_backup),
-- the settings trigger, the two Phase 25 guard log rows, and the anon / authenticated / PUBLIC grants on
-- hmrc_integrations and hmrc_settings.
--
-- !!! It REFUSES while any HMRC P0 table has rows (a company connected, a sign-in in progress, or audit history), unless
-- !!!   SET LOCAL app.hmrc_p0_force = 'on';   (inside the same transaction, after BEGIN)
-- !!! Rolling back removes the companies' HMRC connections (they reconnect after re-applying) and the audit history:
-- !!! export public.hmrc_audit_log first if you need it.
-- !!! Not restored: the per-user client_id / client_secret / redirect_uri values HMRC P0 cleared (1 sandbox row on
-- !!! 4 Nov 2026). The NOT NULL rule on those columns comes back; cleared values become '' (the user re-enters them).
-- !!! Undeploy hmrc-connect-start / -complete / -disconnect first and publish the previous frontend.
-- =====================================================================================================================
BEGIN;
DO $$
BEGIN
  IF to_regclass('public.hmrc_p0_backup') IS NULL OR to_regclass('public.hmrc_connections') IS NULL THEN
    RAISE EXCEPTION 'HMRC P0 is not applied';
  END IF;
  IF (SELECT count(*) FROM public.hmrc_p0_backup WHERE kind = 'function') <> 5 OR (SELECT count(*) FROM public.hmrc_p0_backup WHERE kind = 'guard') <> 2
     OR (SELECT count(*) FROM public.hmrc_p0_backup WHERE kind = 'trigger') <> 1 THEN
    RAISE EXCEPTION 'HMRC P0 backup is incomplete';
  END IF;
  IF (EXISTS (SELECT 1 FROM public.hmrc_connections) OR EXISTS (SELECT 1 FROM public.hmrc_oauth_states) OR EXISTS (SELECT 1 FROM public.hmrc_audit_log))
     AND COALESCE(current_setting('app.hmrc_p0_force', true), '') <> 'on' THEN
    RAISE EXCEPTION 'HMRC P0 has data (% connection(s), % sign-in state(s), % audit row(s)). Export what you need, then SET LOCAL app.hmrc_p0_force = ''on''.',
      (SELECT count(*) FROM public.hmrc_connections), (SELECT count(*) FROM public.hmrc_oauth_states), (SELECT count(*) FROM public.hmrc_audit_log);
  END IF;
END $$;

DELETE FROM public.phase25_mfa_guard_log
 WHERE fn IN ('public.hmrc_can_manage(uuid)', 'public.hmrc_connection_status(uuid)', 'public.hmrc_audit_events(uuid,integer)');
DROP FUNCTION public.hmrc_audit_events(uuid, integer);
DROP FUNCTION public.hmrc_connection_status(uuid);
DROP FUNCTION public.hmrc_can_manage(uuid);
DROP FUNCTION public.hmrc_claim_refresh(uuid, text, integer);
DROP FUNCTION public.hmrc_consume_state(text, uuid);
DROP FUNCTION public.hmrc_manage_allowed(uuid, uuid);
DROP TABLE public.hmrc_audit_log;           -- DROP is not blocked by the append-only row triggers
DROP TABLE public.hmrc_oauth_states;
DROP TABLE public.hmrc_connections;
DROP FUNCTION public._hmrc_audit_append_only();
DROP FUNCTION public._hmrc_touch();

-- The old functions, exactly as they were (bodies and privileges checked).
DO $$
DECLARE r record; want text[]; got text[];
BEGIN
  FOR r IN SELECT * FROM public.hmrc_p0_backup WHERE kind = 'function' ORDER BY name LOOP
    EXECUTE r.def;
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', r.name);
    FOR want IN SELECT ARRAY[CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE quote_ident(a.grantee::regrole::text) END]
                  FROM aclexplode(r.acl::aclitem[]) a WHERE a.privilege_type = 'EXECUTE' LOOP
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO %s', r.name, want[1]);
    END LOOP;
    SELECT array_agg(x ORDER BY x) INTO got FROM unnest((SELECT proacl::text[] FROM pg_proc WHERE oid = to_regprocedure(r.name))) x;
    SELECT array_agg(x ORDER BY x) INTO want FROM unnest(r.acl::text[]) x;
    IF got IS DISTINCT FROM want THEN RAISE EXCEPTION '% privileges differ from the saved ones', r.name; END IF;
  END LOOP;
END $$;

-- hmrc_settings: credential columns back to NOT NULL (cleared values become ''), trigger back.
ALTER TABLE public.hmrc_settings DROP CONSTRAINT hmrc_settings_no_credentials;
UPDATE public.hmrc_settings SET client_id = COALESCE(client_id, ''), client_secret = COALESCE(client_secret, ''), redirect_uri = COALESCE(redirect_uri, '');
ALTER TABLE public.hmrc_settings ALTER COLUMN client_id SET NOT NULL, ALTER COLUMN client_secret SET NOT NULL, ALTER COLUMN redirect_uri SET NOT NULL;
DO $$ BEGIN EXECUTE (SELECT def FROM public.hmrc_p0_backup WHERE kind = 'trigger'); END $$;

-- The anon / authenticated / PUBLIC grants on hmrc_integrations and hmrc_settings, exactly as saved.
DO $$
DECLARE t text; c record; a record;
BEGIN
  FOREACH t IN ARRAY ARRAY['public.hmrc_integrations', 'public.hmrc_settings'] LOOP
    EXECUTE format('REVOKE ALL ON %s FROM PUBLIC, anon, authenticated', t);
    FOR c IN SELECT attname FROM pg_attribute WHERE attrelid = t::regclass AND attnum > 0 AND NOT attisdropped LOOP
      EXECUTE format('REVOKE ALL (%I) ON %s FROM PUBLIC, anon, authenticated', c.attname, t);
    END LOOP;
    FOR a IN SELECT x.privilege_type, x.grantee FROM public.hmrc_p0_backup b, aclexplode(b.acl::aclitem[]) x
              WHERE b.kind = 'table' AND b.name = t
                AND (x.grantee = 0 OR x.grantee IN ('anon'::regrole, 'authenticated'::regrole)) LOOP
      EXECUTE format('GRANT %s ON %s TO %s', a.privilege_type, t, CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE quote_ident(a.grantee::regrole::text) END);
    END LOOP;
    FOR a IN SELECT split_part(b.name, '.', 3) AS col, x.privilege_type, x.grantee FROM public.hmrc_p0_backup b, aclexplode(b.acl::aclitem[]) x
              WHERE b.kind = 'column' AND b.name LIKE t || '.%'
                AND (x.grantee = 0 OR x.grantee IN ('anon'::regrole, 'authenticated'::regrole)) LOOP
      EXECUTE format('GRANT %s (%I) ON %s TO %s', a.privilege_type, a.col, t, CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE quote_ident(a.grantee::regrole::text) END);
    END LOOP;
  END LOOP;
END $$;

INSERT INTO public.phase25_mfa_guard_log (fn, kind, old_md5, new_md5, applied_at)
SELECT j ->> 'fn', j ->> 'kind', j ->> 'old_md5', j ->> 'new_md5', (j ->> 'applied_at')::timestamptz
  FROM (SELECT def::json AS j FROM public.hmrc_p0_backup WHERE kind = 'guard') g;

DROP TABLE public.hmrc_p0_backup;
COMMIT;
