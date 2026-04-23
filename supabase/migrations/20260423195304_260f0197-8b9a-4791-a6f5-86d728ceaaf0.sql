
-- 1. Verified wallet links
CREATE TABLE public.staking_wallet_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  wallet_address TEXT NOT NULL,
  chain_id INTEGER NOT NULL DEFAULT 1,
  signature TEXT NOT NULL,
  signed_message TEXT NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, wallet_address, chain_id)
);

ALTER TABLE public.staking_wallet_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own wallet links" ON public.staking_wallet_links
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own wallet links" ON public.staking_wallet_links
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own wallet links" ON public.staking_wallet_links
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own wallet links" ON public.staking_wallet_links
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_wallet_links_user ON public.staking_wallet_links(user_id, is_active);

-- 2. Transaction lifecycle
CREATE TABLE public.staking_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  stake_id UUID REFERENCES public.user_stakes(id) ON DELETE SET NULL,
  tx_type TEXT NOT NULL CHECK (tx_type IN ('stake','unstake','claim')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','submitted','confirmed','failed')),
  amount NUMERIC NOT NULL DEFAULT 0,
  wallet_address TEXT,
  chain_id INTEGER,
  tx_hash TEXT,
  block_number BIGINT,
  error_message TEXT,
  submitted_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.staking_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own staking tx" ON public.staking_transactions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own staking tx" ON public.staking_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own staking tx" ON public.staking_transactions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX idx_staking_tx_user ON public.staking_transactions(user_id, created_at DESC);
CREATE INDEX idx_staking_tx_stake ON public.staking_transactions(stake_id);

-- 3. Reward pools (admin-managed, public read)
CREATE TABLE public.staking_reward_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  total_budget NUMERIC NOT NULL,
  emitted_amount NUMERIC NOT NULL DEFAULT 0,
  start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date TIMESTAMPTZ NOT NULL,
  emission_per_second NUMERIC NOT NULL,
  reward_token TEXT NOT NULL DEFAULT 'B2BN',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.staking_reward_pools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active reward pools" ON public.staking_reward_pools
  FOR SELECT USING (is_active = true);
CREATE POLICY "Only admins manage reward pools" ON public.staking_reward_pools
  FOR ALL USING (public.is_admin_or_owner(auth.uid()))
  WITH CHECK (public.is_admin_or_owner(auth.uid()));

-- Seed a default 6-month pool: 500,000 B2BN over ~180 days
INSERT INTO public.staking_reward_pools (name, description, total_budget, end_date, emission_per_second)
VALUES (
  'Genesis Participation Pool',
  'Initial 6-month revenue-share pool. Distributes B2BN proportional to weighted stake.',
  500000,
  now() + interval '180 days',
  500000.0 / (180 * 86400)
);

-- 4. Augment user_stakes
ALTER TABLE public.user_stakes
  ADD COLUMN IF NOT EXISTS wallet_link_id UUID REFERENCES public.staking_wallet_links(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_claim_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accrued_rewards NUMERIC NOT NULL DEFAULT 0;

-- 5. Emission preview function (Synthetix-style proportional)
CREATE OR REPLACE FUNCTION public.preview_user_emissions(_user_id UUID)
RETURNS TABLE (
  pool_id UUID,
  pool_name TEXT,
  user_weighted_stake NUMERIC,
  total_weighted_stake NUMERIC,
  user_share_percent NUMERIC,
  pool_remaining NUMERIC,
  emission_per_second NUMERIC,
  user_emission_per_day NUMERIC,
  user_pending_since_last_claim NUMERIC,
  next_claim_available_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pool RECORD;
  v_user_weight NUMERIC := 0;
  v_total_weight NUMERIC := 0;
  v_last_claim TIMESTAMPTZ;
  v_seconds_since NUMERIC;
  v_share NUMERIC := 0;
BEGIN
  SELECT * INTO v_pool
  FROM public.staking_reward_pools
  WHERE is_active = true AND now() BETWEEN start_date AND end_date
  ORDER BY start_date DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(amount * apy_percentage), 0) INTO v_user_weight
  FROM public.user_stakes
  WHERE user_id = _user_id AND status = 'active';

  SELECT COALESCE(SUM(amount * apy_percentage), 0) INTO v_total_weight
  FROM public.user_stakes
  WHERE status = 'active';

  IF v_total_weight > 0 THEN
    v_share := v_user_weight / v_total_weight;
  END IF;

  SELECT COALESCE(MAX(last_claim_at), MIN(staked_at)) INTO v_last_claim
  FROM public.user_stakes
  WHERE user_id = _user_id AND status = 'active';

  v_seconds_since := EXTRACT(EPOCH FROM (now() - COALESCE(v_last_claim, now())));

  RETURN QUERY SELECT
    v_pool.id,
    v_pool.name,
    v_user_weight,
    v_total_weight,
    ROUND(v_share * 100, 4),
    GREATEST(v_pool.total_budget - v_pool.emitted_amount, 0),
    v_pool.emission_per_second,
    ROUND(v_pool.emission_per_second * v_share * 86400, 6),
    ROUND(v_pool.emission_per_second * v_share * v_seconds_since, 6),
    COALESCE(v_last_claim, now()) + interval '7 days';
END;
$$;

-- 6. Triggers for updated_at
CREATE TRIGGER update_wallet_links_updated_at
  BEFORE UPDATE ON public.staking_wallet_links
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_staking_tx_updated_at
  BEFORE UPDATE ON public.staking_transactions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_reward_pools_updated_at
  BEFORE UPDATE ON public.staking_reward_pools
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
