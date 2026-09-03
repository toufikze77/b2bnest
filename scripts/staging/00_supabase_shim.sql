-- Supabase-compatible shim for isolated local staging (NOT production)
create schema if not exists extensions;
create extension if not exists pgcrypto with schema public;
-- production installs uuid-ossp into the "extensions" schema; defaults reference
-- extensions.uuid_generate_v4(), so it must live there in staging too
create extension if not exists "uuid-ossp" with schema extensions;
create schema if not exists graphql_public;
create schema if not exists auth;
create schema if not exists storage;
create schema if not exists realtime;
create schema if not exists vault;
do $$ begin
  create role anon nologin noinherit;
exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin noinherit; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin noinherit bypassrls; exception when duplicate_object then null; end $$;
do $$ begin create role authenticator noinherit login password 'x'; exception when duplicate_object then null; end $$;
do $$ begin create role supabase_auth_admin superuser login password 'x'; exception when duplicate_object then null; end $$;
do $$ begin create role supabase_storage_admin superuser login password 'x'; exception when duplicate_object then null; end $$;
do $$ begin create role supabase_admin superuser login password 'x'; exception when duplicate_object then null; end $$;
grant anon, authenticated, service_role to authenticator;
grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth, storage, extensions to anon, authenticated, service_role;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  encrypted_password text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  raw_app_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_sign_in_at timestamptz,
  email_confirmed_at timestamptz default now(),
  confirmed_at timestamptz default now(),
  deleted_at timestamptz,
  banned_until timestamptz,
  phone text,
  role text default 'authenticated',
  aud text default 'authenticated'
);
create table if not exists auth.identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  provider text, identity_data jsonb, created_at timestamptz default now()
);
create table if not exists auth.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;
create or replace function auth.role() returns text language sql stable as $$
  select coalesce(auth.jwt() ->> 'role', current_setting('role', true))
$$;
create or replace function auth.email() returns text language sql stable as $$
  select auth.jwt() ->> 'email'
$$;
grant execute on function auth.uid(), auth.jwt(), auth.role(), auth.email() to public;
grant select on auth.users to service_role;

-- storage shim mirroring Supabase storage schema
create table if not exists storage.buckets (
  id text primary key, name text not null, owner uuid, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[],
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text, owner uuid, owner_id text,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  last_accessed_at timestamptz default now(), metadata jsonb, path_tokens text[]
    generated always as (string_to_array(name, '/')) stored
);
alter table storage.objects enable row level security;
alter table storage.buckets enable row level security;
grant select on storage.buckets to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated;
grant all on storage.objects, storage.buckets to service_role;
create or replace function storage.foldername(name text) returns text[]
  language sql immutable as $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
create or replace function storage.filename(name text) returns text
  language sql immutable as $$ select (string_to_array(name,'/'))[array_length(string_to_array(name,'/'),1)] $$;
create or replace function storage.extension(name text) returns text
  language sql immutable as $$ select split_part(storage.filename(name), '.', 2) $$;

-- vault shim (secrets referenced by encrypt/decrypt helpers)
create table if not exists vault.secrets (
  id uuid primary key default gen_random_uuid(), name text unique, secret text,
  created_at timestamptz default now()
);
create or replace view vault.decrypted_secrets as
  select id, name, secret, secret as decrypted_secret, created_at from vault.secrets;

-- pg_net / http shims used by some functions
create schema if not exists net;
create or replace function net.http_post(url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb, headers jsonb default '{}'::jsonb, timeout_milliseconds int default 5000)
  returns bigint language sql as $$ select 0::bigint $$;
