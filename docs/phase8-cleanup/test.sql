-- Read-only check for docs/phase8-cleanup/proposal.sql. Changes nothing; safe on production.
-- Run it before applying the proposal and again after:
--   before: search_path_fixed = false, result = false
--   after:  search_path_fixed = true,  result = false (unchanged)
SELECT p.oid::regprocedure AS function,
       p.proconfig,
       coalesce('search_path=""' = ANY (p.proconfig), false) AS search_path_fixed,
       public._seat_caps_enabled() AS result,
       pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
WHERE p.oid = 'public._seat_caps_enabled()'::regprocedure;
