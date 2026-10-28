-- Phase 12b data step — PREPARED, NOT APPLIED. Run once, right AFTER proposal.sql and BEFORE the new frontend ships.
-- Seeds master_access with the two owner accounts, looked up BY EMAIL. Idempotent (ON CONFLICT DO NOTHING); an email
-- with no account is skipped and reported. Nothing else changes. Applied by the operator (service role / SQL editor),
-- so there is no super-admin caller to record in admin_audit_logs; the note on each row records where it came from.
BEGIN;
DO $$
DECLARE _email text; _id uuid; _added int;
BEGIN
  FOREACH _email IN ARRAY ARRAY['toufikze@gmail.com', 'toufik.zemri@outlook.com'] LOOP
    SELECT u.id INTO _id FROM auth.users u WHERE lower(u.email) = _email;
    IF _id IS NULL THEN
      RAISE NOTICE 'skipped %: no account with this email', _email;
      CONTINUE;
    END IF;
    INSERT INTO public.master_access(user_id, granted_by, note)
    VALUES (_id, NULL, 'Phase 12b seed: owner account')
    ON CONFLICT (user_id) DO NOTHING;
    GET DIAGNOSTICS _added = ROW_COUNT;
    RAISE NOTICE '%: %', _email, CASE WHEN _added = 1 THEN 'master account switched on' ELSE 'already a master account' END;
  END LOOP;
END $$;
COMMIT;
