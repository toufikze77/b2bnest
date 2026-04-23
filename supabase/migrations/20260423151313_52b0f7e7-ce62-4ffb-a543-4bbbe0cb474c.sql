-- Switch staking model from fixed APY to halal-compatible revenue share
UPDATE public.staking_tiers
SET 
  apy_percentage = 1.0,
  monthly_credits = 100,
  perks = '["Earn from real platform revenue","Variable monthly profit share","100 AI credits/month","Community access"]'::jsonb
WHERE name = 'Bronze';

UPDATE public.staking_tiers
SET 
  apy_percentage = 1.5,
  monthly_credits = 500,
  perks = '["Higher revenue share weight","Variable monthly profit share","500 AI credits/month","Premium feature access","Priority support"]'::jsonb
WHERE name = 'Silver';

UPDATE public.staking_tiers
SET 
  apy_percentage = 2.5,
  monthly_credits = 2000,
  perks = '["Boosted revenue share weight","Variable monthly profit share","2,000 AI credits/month","All premium features unlocked","Early access to new tools","Governance voting (future)"]'::jsonb
WHERE name = 'Gold';

UPDATE public.staking_tiers
SET 
  apy_percentage = 4.0,
  monthly_credits = 10000,
  perks = '["Maximum revenue share weight","Variable monthly profit share","10,000 AI credits/month","All premium features unlocked","Direct revenue distribution","Governance voting (future)","VIP support & strategy calls"]'::jsonb
WHERE name = 'Diamond';