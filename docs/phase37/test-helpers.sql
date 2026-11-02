-- Phase 37 test helpers (session-local). pg_temp.ok / pg_temp.fails raise WARNING 'PASS|...' or EXCEPTION 'FAIL|...'.
SET client_min_messages = warning;
CREATE FUNCTION pg_temp.ok(cond boolean, name text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FAIL|%', name; END IF;
  RAISE WARNING 'PASS|%', name;
END $$;
CREATE FUNCTION pg_temp.fails(sql text, want text, name text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE sql; EXCEPTION WHEN OTHERS THEN
    IF position(want in SQLERRM) > 0 THEN RAISE WARNING 'PASS|%', name; RETURN; END IF;
    RAISE EXCEPTION 'FAIL|% (wrong error: %)', name, SQLERRM;
  END;
  RAISE EXCEPTION 'FAIL|% (no error)', name;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.ok(boolean, text), pg_temp.fails(text, text, text) TO PUBLIC;
