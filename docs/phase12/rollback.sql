-- Phase 12 rollback — PREPARED, NOT APPLIED. Undoes proposal.sql in one transaction.
-- Restores the exact profiles grants read on 2026-10-27 (live ACL {postgres=arwdDxtm, service_role=arwdDxtm,
-- authenticated=arw} and the column SELECT grants for anon/authenticated, which proposal.sql never touched), and drops
-- the access functions. WARNING: this re-opens the trial hole (any signed-in user can change their own trial dates).
-- If data-step.sql was applied, undo it first with data-step-rollback.sql (optional; the flags are cosmetic).
BEGIN;
DROP FUNCTION public.my_access_state();
DROP FUNCTION public._access_state_for(uuid);
DROP FUNCTION public._access_entitled(text, boolean);

-- Column-level INSERT/UPDATE grants added by proposal.sql
REVOKE INSERT (id, email, full_name, avatar_url, created_at, updated_at, headline, location, industry, experience_years, company, position,
               bio, skills, website, linkedin_url, twitter_url, is_public, connection_count, currency_code, timezone, country_code,
               language_code, date_format, time_format, display_name, is_active, theme),
       UPDATE (id, email, full_name, avatar_url, created_at, updated_at, headline, location, industry, experience_years, company, position,
               bio, skills, website, linkedin_url, twitter_url, is_public, connection_count, currency_code, timezone, country_code,
               language_code, date_format, time_format, display_name, is_active, theme) ON public.profiles FROM authenticated;
-- Live table-level grants (verbatim from the 2026-10-27 reading: authenticated=arw)
GRANT INSERT, SELECT, UPDATE ON public.profiles TO authenticated;
COMMIT;
