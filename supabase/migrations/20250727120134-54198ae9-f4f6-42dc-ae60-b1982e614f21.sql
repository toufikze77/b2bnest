-- Add currency column to crm_deals table
ALTER TABLE public.crm_deals ADD COLUMN currency text DEFAULT 'USD';