-- Rollback for proposal.sql (drops only the three new tables).
DROP TABLE IF EXISTS public.marketing_content_items;
DROP TABLE IF EXISTS public.marketing_campaigns;
DROP TABLE IF EXISTS public.marketing_audiences;
