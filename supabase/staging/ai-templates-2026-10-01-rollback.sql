-- Rollback for ai-templates-2026-10-01.sql. Removes only the new objects.
-- subscribers balances are NOT touched: before rolling back, run
--   select public.ai_expire_stale_generations();  -- refunds any open reservations
-- and export ai_credit_ledger if the audit trail must be kept.
begin;
drop function if exists public.review_generated_template(uuid,boolean,text);
drop function if exists public.submit_generated_template(uuid);
drop function if exists public.ai_expire_stale_generations();
drop function if exists public.ai_settle_generation(uuid,text,jsonb);
drop function if exists public.ai_refund_generation(uuid,text);
drop function if exists public.ai_reserve_generation(uuid,uuid,text,text);
drop function if exists public.ai_record_provider_call(uuid,uuid,text,text,text,integer,integer,bigint,integer);
drop function if exists public.ai_probe_budget();
drop function if exists public.ai_admin_spend_pence_this_month();
drop table if exists public.ai_provider_calls;
drop table if exists public.generated_templates;
drop table if exists public.ai_credit_ledger;
drop table if exists public.ai_generation_requests;
drop table if exists public.ai_generation_config;
commit;
