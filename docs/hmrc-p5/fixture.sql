-- HMRC P5 local fixture: profiles.currency_code exactly as production (text, default 'USD', read 8 Nov 2026).
-- The earlier local fixtures don't have it. Loaded after the HMRC P4, P4b and P4b option B files.
BEGIN;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS currency_code text DEFAULT 'USD'::text;
COMMIT;
