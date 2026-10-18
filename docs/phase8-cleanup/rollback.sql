-- Rollback for docs/phase8-cleanup/proposal.sql: back to no fixed search_path (proconfig NULL), as before.
-- Safe to re-run.
ALTER FUNCTION public._seat_caps_enabled() RESET search_path;
