-- Add theme preference to profiles table
alter table if exists public.profiles
  add column if not exists theme text default 'light';