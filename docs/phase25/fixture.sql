-- Phase 25 test fixture (local replica only; never production). Supabase Auth's MFA table, with the columns
-- public.mfa_ok() reads (production: auth.mfa_factors, status is the enum auth.factor_status; read 1 Nov 2026).
CREATE TYPE auth.factor_status AS ENUM ('unverified', 'verified');
CREATE TABLE auth.mfa_factors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  friendly_name text,
  factor_type text NOT NULL DEFAULT 'totp',
  status auth.factor_status NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  secret text
);
REVOKE ALL ON auth.mfa_factors FROM PUBLIC, anon, authenticated;

-- public.assert_self exists in production (read verbatim into docs/phase12/fixture-live.sql on 27 Oct 2026) but is not
-- in the repository migrations, so the replica lacks it; the token and banking functions call it.
CREATE OR REPLACE FUNCTION public.assert_self(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  -- server/service paths keep working
  if coalesce(auth.role(), current_user) in ('service_role','postgres','supabase_admin') then
    return;
  end if;
  if auth.uid() is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_user_id is null or p_user_id is distinct from auth.uid() then
    raise exception 'Access denied' using errcode = '42501';
  end if;
end;
$function$;
