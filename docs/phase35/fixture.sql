-- Phase 35 test fixture (DISPOSABLE local Postgres only; never production). Run after scripts/staging/00_supabase_shim.sql.
-- The tables Phase 35 touches, with the production columns, and the functions it replaces or calls, copied VERBATIM
-- from production on 2 Nov 2026 (pg_get_functiondef), with production's privileges (pg_proc.proacl) and Phase 25 guard
-- log rows. run-test.sh checks md5(prosrc) of each copied body against the production hash before anything else, so the
-- proposal's own hash checks run against byte-identical bodies.

CREATE TYPE auth.factor_status AS ENUM ('unverified', 'verified');
CREATE TABLE auth.mfa_factors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, factor_type text NOT NULL DEFAULT 'totp',
  status auth.factor_status NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'user');
CREATE TABLE public.user_roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, role public.app_role NOT NULL);
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY, email text, full_name text, display_name text, created_at timestamptz DEFAULT now()
);
-- public.subscribers: the production columns (information_schema, 2 Nov 2026).
CREATE TABLE public.subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid UNIQUE, email text, stripe_customer_id text,
  subscribed boolean NOT NULL DEFAULT false, subscription_tier text, subscription_end timestamptz,
  updated_at timestamptz DEFAULT now(), created_at timestamptz DEFAULT now(),
  ai_credits_remaining integer DEFAULT 0, ai_credits_limit integer DEFAULT 0,
  ai_credits_reset_date timestamptz DEFAULT (now() + '1 mon'::interval),
  stripe_subscription_id text, stripe_price_id text, plan_key text, billing_interval text, subscription_status text,
  current_period_start timestamptz, current_period_end timestamptz, cancel_at_period_end boolean, canceled_at timestamptz,
  payment_status text, stripe_state_at bigint
);
ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.security_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id), admin_requires_aal2 boolean NOT NULL DEFAULT true, updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.security_settings (id, admin_requires_aal2) VALUES (true, true);
CREATE TABLE public.phase25_mfa_guard_log (
  fn text PRIMARY KEY, kind text NOT NULL, old_md5 text NOT NULL, new_md5 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
);
-- Production rows for the two functions Phase 35 changes (2 Nov 2026), plus one unrelated row that must not change.
INSERT INTO public.phase25_mfa_guard_log (fn, kind, old_md5, new_md5, applied_at) VALUES
  ('public.check_and_deduct_ai_credit(uuid,integer)', 'user', '53eb000e38a6e12091f01db15d67fe33', 'be23bdba849254ef8dda291c9beee2e5', '2026-11-01 14:48:38.473163+00'),
  ('public.get_ai_credits_info(uuid)', 'user', 'a7798e0139e35a8b906cda0e646dd01f', '2cac6615542d149b7ae9b126b1388280', '2026-11-01 14:48:38.473163+00'),
  ('public.admin_ai_stats(integer)', 'admin', '5a17153d6ec7b5ba4ce88951c9718d32', 'a9b59459c95004fc16f844843055eb33', '2026-11-01 14:48:38.473163+00');

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

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'::public.app_role
  )
$function$;

CREATE OR REPLACE FUNCTION public.mfa_ok()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  -- server/service paths keep working (same rule as public.assert_self)
  if coalesce(auth.role(), current_user) in ('service_role','postgres','supabase_admin') then
    return true;
  end if;
  if coalesce(auth.jwt() ->> 'aal', '') = 'aal2' then
    return true;
  end if;
  if auth.uid() is null then
    return true; -- no user, nothing enrolled: the table's own policies decide
  end if;
  return not exists (
    select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status::text = 'verified'
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.require_aal2_if_enrolled()
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.mfa_ok() then
    raise exception 'MFA_REQUIRED' using errcode = '42501', hint = 'Enter the 6-digit code from your authenticator app.';
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.require_aal2_admin()
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform public.require_aal2_if_enrolled();
  if coalesce(auth.role(), current_user) in ('service_role','postgres','supabase_admin') then
    return;
  end if;
  -- Super admins need aal2 for Admin even before they have set up an app (the frontend sends them to set one up).
  if public.is_super_admin(auth.uid())
     and coalesce((select s.admin_requires_aal2 from public.security_settings s where s.id), true)
     and coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'MFA_REQUIRED' using errcode = '42501', hint = 'Admin needs two-step sign-in.';
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.check_and_deduct_ai_credit(p_user_id uuid, p_credits_to_deduct integer DEFAULT 1)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_subscriber RECORD;
  v_result JSON;
BEGIN
  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard
  IF NOT (
    auth.uid() = p_user_id
    OR COALESCE(auth.role(), current_user) IN ('service_role', 'postgres', 'supabase_admin')
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_credits_to_deduct IS NULL OR p_credits_to_deduct < 1 OR p_credits_to_deduct > 1000 THEN
    RAISE EXCEPTION 'Invalid credit amount';
  END IF;

  SELECT * INTO v_subscriber FROM public.subscribers WHERE user_id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.subscribers (user_id, email, subscribed, subscription_tier, ai_credits_limit, ai_credits_remaining)
    VALUES (p_user_id, (SELECT email FROM auth.users WHERE id = p_user_id), false, 'free', 10, 10)
    RETURNING * INTO v_subscriber;
  END IF;

  IF v_subscriber.ai_credits_reset_date <= NOW() THEN
    UPDATE public.subscribers
    SET ai_credits_remaining = ai_credits_limit,
        ai_credits_reset_date = NOW() + interval '1 month'
    WHERE user_id = p_user_id
    RETURNING * INTO v_subscriber;
  END IF;

  IF v_subscriber.ai_credits_remaining < p_credits_to_deduct THEN
    RETURN json_build_object(
      'success', false, 'error', 'insufficient_credits',
      'credits_remaining', v_subscriber.ai_credits_remaining,
      'credits_limit', v_subscriber.ai_credits_limit,
      'reset_date', v_subscriber.ai_credits_reset_date,
      'subscription_tier', v_subscriber.subscription_tier);
  END IF;

  UPDATE public.subscribers
  SET ai_credits_remaining = ai_credits_remaining - p_credits_to_deduct
  WHERE user_id = p_user_id
  RETURNING json_build_object(
    'success', true,
    'credits_remaining', ai_credits_remaining,
    'credits_limit', ai_credits_limit,
    'reset_date', ai_credits_reset_date,
    'subscription_tier', subscription_tier) INTO v_result;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_ai_credits_info(p_user_id uuid DEFAULT auth.uid())
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_subscriber record;
begin
  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard
  perform public.assert_self(p_user_id);
  select * into v_subscriber from public.subscribers where user_id = p_user_id;
  if not found then
    return json_build_object('credits_remaining',10,'credits_limit',10,
                             'reset_date', now() + interval '1 month','subscription_tier','free');
  end if;
  if v_subscriber.ai_credits_reset_date <= now() then
    update public.subscribers set ai_credits_remaining = ai_credits_limit,
      ai_credits_reset_date = now() + interval '1 month'
    where user_id = p_user_id returning * into v_subscriber;
  end if;
  return json_build_object('credits_remaining', v_subscriber.ai_credits_remaining,
    'credits_limit', v_subscriber.ai_credits_limit, 'reset_date', v_subscriber.ai_credits_reset_date,
    'subscription_tier', v_subscriber.subscription_tier);
end;
$function$;

CREATE OR REPLACE FUNCTION public.refund_ai_credit(p_user_id uuid, p_credits integer DEFAULT 1)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_before integer;
  v_after integer;
  v_limit integer;
  v_reset timestamptz;
BEGIN
  IF COALESCE(auth.role(), current_user) NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_user_id IS NULL OR p_credits IS NULL OR p_credits < 1 OR p_credits > 1000 THEN
    RAISE EXCEPTION 'Invalid credit amount';
  END IF;

  SELECT ai_credits_remaining, ai_credits_limit INTO v_before, v_limit
    FROM public.subscribers WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'no_subscriber', 'refunded', 0);
  END IF;

  UPDATE public.subscribers
     SET ai_credits_remaining = GREATEST(COALESCE(ai_credits_remaining, 0),
                                         LEAST(COALESCE(ai_credits_limit, 0), COALESCE(ai_credits_remaining, 0) + p_credits))
   WHERE user_id = p_user_id
  RETURNING ai_credits_remaining, ai_credits_reset_date INTO v_after, v_reset;

  RETURN json_build_object(
    'success', true,
    'refunded', GREATEST(0, v_after - COALESCE(v_before, 0)),
    'credits_remaining', v_after,
    'credits_limit', v_limit,
    'reset_date', v_reset);
END;
$function$;

-- Production privileges (pg_proc.proacl, 2 Nov 2026).
REVOKE ALL ON FUNCTION public.check_and_deduct_ai_credit(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_and_deduct_ai_credit(uuid, integer) TO service_role, authenticated;
REVOKE ALL ON FUNCTION public.refund_ai_credit(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_ai_credit(uuid, integer) TO service_role;
REVOKE ALL ON FUNCTION public.get_ai_credits_info(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ai_credits_info(uuid) TO service_role, authenticated;
REVOKE ALL ON FUNCTION public.assert_self(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_self(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mfa_ok(), public.require_aal2_if_enrolled(), public.require_aal2_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mfa_ok(), public.require_aal2_if_enrolled(), public.require_aal2_admin() TO authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON public.subscribers, public.profiles, public.user_roles TO service_role;
