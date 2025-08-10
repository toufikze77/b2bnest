-- Add theme preference to profiles table
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS theme text DEFAULT 'light';