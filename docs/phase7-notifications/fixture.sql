-- LOCAL THROWAWAY DATABASE ONLY (used by run-test.sh). Never run this on production: it creates roles, schemas and tables.
-- A minimal copy of the production shapes Phase 7 touches (columns, NOT NULLs, defaults and RLS as read on 2026-10-18),
-- plus Supabase's default grants, so the proposal's REVOKEs and policies are really exercised.
\set ON_ERROR_STOP 1
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
-- Same body as production's auth.uid().
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;
GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);

CREATE TABLE public.profiles (id uuid PRIMARY KEY, timezone text DEFAULT 'UTC', created_at timestamptz DEFAULT now());
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, title text NOT NULL, message text NOT NULL,
  type text DEFAULT 'info', read boolean DEFAULT false, created_at timestamptz DEFAULT now());
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own select" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own update" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, invoice_number text NOT NULL, client_name text,
  total_amount numeric DEFAULT 0, currency text DEFAULT 'USD', due_date date, status text DEFAULT 'pending',
  paid_at timestamptz, archived_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, quote_number text NOT NULL, client_name text,
  total_amount numeric DEFAULT 0, currency text DEFAULT 'USD', status text DEFAULT 'draft',
  archived_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, title text NOT NULL, reminder_date timestamptz,
  is_archived boolean DEFAULT false, is_template boolean DEFAULT false, created_at timestamptz DEFAULT now());
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY; ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY; ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own" ON public.invoices USING (auth.uid() = user_id);
CREATE POLICY "own" ON public.quotes USING (auth.uid() = user_id);
CREATE POLICY "own" ON public.notes USING (auth.uid() = user_id);
-- Two notifications that exist before the proposal (like production's 'welcome' / 'info' rows), to prove they are untouched.
INSERT INTO auth.users VALUES ('99999999-0000-4000-8000-000000000009', 'existing@owner.test');
INSERT INTO public.notifications (user_id, title, message, type) VALUES
  ('99999999-0000-4000-8000-000000000009', 'Welcome', 'Hello', 'welcome'),
  ('99999999-0000-4000-8000-000000000009', 'FYI', 'Something', 'info');
