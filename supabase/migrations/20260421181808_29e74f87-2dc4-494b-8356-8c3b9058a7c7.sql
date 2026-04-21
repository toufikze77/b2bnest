
CREATE TABLE public.staking_tiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  min_stake_amount NUMERIC NOT NULL,
  apy_percentage NUMERIC NOT NULL DEFAULT 0,
  monthly_credits INTEGER NOT NULL DEFAULT 0,
  perks JSONB NOT NULL DEFAULT '[]'::jsonb,
  badge_color TEXT NOT NULL DEFAULT 'gray',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.staking_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active staking tiers"
ON public.staking_tiers FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage staking tiers"
ON public.staking_tiers FOR ALL
USING (is_admin_or_owner(auth.uid()))
WITH CHECK (is_admin_or_owner(auth.uid()));

CREATE TABLE public.user_stakes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  lock_period_days INTEGER NOT NULL DEFAULT 30 CHECK (lock_period_days >= 0),
  apy_percentage NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'unstaked', 'pending')),
  staked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unlocks_at TIMESTAMPTZ NOT NULL,
  unstaked_at TIMESTAMPTZ,
  wallet_address TEXT,
  transaction_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_stakes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own stakes"
ON public.user_stakes FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own stakes"
ON public.user_stakes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stakes"
ON public.user_stakes FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all stakes"
ON public.user_stakes FOR SELECT
USING (is_admin_or_owner(auth.uid()));

CREATE TABLE public.staking_rewards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stake_id UUID REFERENCES public.user_stakes(id) ON DELETE CASCADE,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('credits', 'tokens', 'revenue_share', 'bonus')),
  amount NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  claimed BOOLEAN NOT NULL DEFAULT false,
  claimed_at TIMESTAMPTZ,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.staking_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own rewards"
ON public.staking_rewards FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own rewards"
ON public.staking_rewards FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all rewards"
ON public.staking_rewards FOR ALL
USING (is_admin_or_owner(auth.uid()))
WITH CHECK (is_admin_or_owner(auth.uid()));

CREATE INDEX idx_user_stakes_user_id ON public.user_stakes(user_id);
CREATE INDEX idx_user_stakes_status ON public.user_stakes(status);
CREATE INDEX idx_staking_rewards_user_id ON public.staking_rewards(user_id);

CREATE TRIGGER update_staking_tiers_updated_at
BEFORE UPDATE ON public.staking_tiers
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_user_stakes_updated_at
BEFORE UPDATE ON public.user_stakes
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE FUNCTION public.get_user_staking_tier(_user_id UUID)
RETURNS TABLE (
  tier_id UUID,
  tier_name TEXT,
  total_staked NUMERIC,
  monthly_credits INTEGER,
  apy_percentage NUMERIC,
  badge_color TEXT,
  perks JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH user_total AS (
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM public.user_stakes
    WHERE user_id = _user_id AND status = 'active'
  )
  SELECT 
    st.id,
    st.name,
    ut.total,
    st.monthly_credits,
    st.apy_percentage,
    st.badge_color,
    st.perks
  FROM public.staking_tiers st, user_total ut
  WHERE st.is_active = true AND st.min_stake_amount <= ut.total
  ORDER BY st.min_stake_amount DESC
  LIMIT 1;
$$;

INSERT INTO public.staking_tiers (name, min_stake_amount, apy_percentage, monthly_credits, badge_color, sort_order, perks) VALUES
('Bronze', 1000, 5, 50, 'amber', 1, '["Basic staking rewards", "Bronze holder badge", "+50 monthly AI credits"]'::jsonb),
('Silver', 10000, 8, 200, 'slate', 2, '["Silver holder badge", "+200 monthly AI credits", "Priority support", "Early feature access"]'::jsonb),
('Gold', 50000, 12, 500, 'yellow', 3, '["Gold holder badge", "+500 monthly AI credits", "Pro features unlocked", "Exclusive Discord channel", "Monthly AMA access"]'::jsonb),
('Diamond', 250000, 18, 2000, 'cyan', 4, '["Diamond holder badge", "+2000 monthly AI credits", "All Business features", "Revenue share eligibility", "Direct founder access", "Governance voting rights"]'::jsonb);
