-- Application-compatibility tests for the two remediated blockers
-- (oauth-hmrc service-role encryption, subscribers client-insert removal).
-- Isolated local staging only. Requires 10_seed_tenants.sql + 20_security_harness.sql
-- and must run AFTER 30_security_tests.sql (results are appended, not truncated).
set client_min_messages = warning;

-- ===================================================== HMRC (blocker 1)
-- H2: trusted server-side context (service_role, as used by the oauth-hmrc
--     Edge Function) CAN encrypt an HMRC token.
select sec.t('H2','APP/HMRC','encrypt_hmrc_token','SERVICE','EXECUTE (Edge Function path)','-','ALLOW',
  $$select public.encrypt_hmrc_token('SYNTHETIC-TOKEN')$$);

-- H3: browser authenticated client CANNOT execute encrypt_hmrc_token
select sec.t('H3','APP/HMRC','encrypt_hmrc_token','A_OWNER','EXECUTE from browser','-','DENY_ERROR',
  $$select public.encrypt_hmrc_token('SYNTHETIC-TOKEN')$$);
select sec.t('H3','APP/HMRC','decrypt_hmrc_token','A_OWNER','EXECUTE from browser','-','DENY_ERROR',
  $$select public.decrypt_hmrc_token('SYNTHETIC-TOKEN')$$);

-- H4: anonymous caller CANNOT execute encrypt/decrypt
select sec.t('H4','APP/HMRC','encrypt_hmrc_token','ANON','EXECUTE anonymous','-','DENY_ERROR',
  $$select public.encrypt_hmrc_token('SYNTHETIC-TOKEN')$$);
select sec.t('H4','APP/HMRC','decrypt_hmrc_token','ANON','EXECUTE anonymous','-','DENY_ERROR',
  $$select public.decrypt_hmrc_token('SYNTHETIC-TOKEN')$$);

-- H1/H9: legitimate connection + storage path used by the Edge Function
select sec.t('H1','APP/HMRC','hmrc_integrations','SERVICE','UPSERT token row (Edge Function)','A','ALLOW',
  $$insert into public.hmrc_integrations(user_id, organization_id, access_token, refresh_token, is_connected)
    values ('aaaaaaaa-0000-4000-8000-000000000001','0a000000-0000-4000-8000-000000000001','ENC-A','ENC-A-R',true)$$);
select sec.t('H9','APP/HMRC','hmrc_integrations','SERVICE','UPDATE refreshed token','A','ALLOW',
  $$update public.hmrc_integrations set access_token='ENC-A2', expires_at = now() + interval '4 hours'
    where user_id='aaaaaaaa-0000-4000-8000-000000000001'$$);

-- H5: user A cannot read user B HMRC tokens (table + RPC)
select sec.t('H5','APP/HMRC','hmrc_integrations','A_OWNER','SELECT B token row','B','DENY',
  $$select 1 from public.hmrc_integrations where user_id='bbbbbbbb-0000-4000-8000-000000000001'$$);
select sec.t('H5','APP/HMRC','get_hmrc_tokens','A_OWNER','RPC for B user_id','B','DENY_ERROR',
  $$select * from public.get_hmrc_tokens('bbbbbbbb-0000-4000-8000-000000000001')$$);

-- H6: organization A cannot reach organization B HMRC credentials
select sec.t('H6','APP/HMRC','hmrc_settings','A_ADMIN','SELECT org B settings','B','DENY',
  $$select 1 from public.hmrc_settings where organization_id='0b000000-0000-4000-8000-000000000001'$$);
select sec.t('H6','APP/HMRC','get_hmrc_client_secret','A_ADMIN','RPC for B user_id','B','DENY_ERROR',
  $$select public.get_hmrc_client_secret('bbbbbbbb-0000-4000-8000-000000000001')$$);

-- H10: NULL / auth.uid() bypass remains closed
select sec.t('H10','APP/HMRC','get_hmrc_tokens','ANON','RPC with NULL argument','-','DENY_ERROR',
  $$select * from public.get_hmrc_tokens(null)$$);
select sec.t('H10','APP/HMRC','get_hmrc_client_secret','ANON','RPC with NULL argument','-','DENY_ERROR',
  $$select public.get_hmrc_client_secret(null)$$);

-- Ownership forging: caller cannot store a token against another user
select sec.t('H11','APP/HMRC','hmrc_integrations','A_OWNER','INSERT row owned by B','B','DENY_ERROR',
  $$insert into public.hmrc_integrations(user_id, access_token, is_connected)
    values ('bbbbbbbb-0000-4000-8000-000000000001','FORGED',true)$$);

-- ============================================ SUBSCRIPTIONS (blocker 2)
-- S1: customer cannot INSERT arbitrary entitlement
select sec.t('S1','APP/SUB','subscribers','UNASSIGNED','INSERT own free row (old client path)','-','DENY_ERROR',
  $$insert into public.subscribers(user_id, email, subscribed, subscription_tier)
    values ('dddddddd-0000-4000-8000-000000000001','unassigned@test.invalid',false,'free')$$);

-- S2/S3/S4: customer cannot UPDATE own tier / self-assign paid plans
select sec.t('S2','APP/SUB','subscribers','A_OWNER','UPDATE own tier','A','DENY_ERROR',
  $$update public.subscribers set subscription_tier='enterprise' where user_id='aaaaaaaa-0000-4000-8000-000000000001'$$);
select sec.t('S3','APP/SUB','subscribers','A_OWNER','self-assign Professional','A','DENY_ERROR',
  $$update public.subscribers set subscription_tier='professional', subscribed=true
    where user_id='aaaaaaaa-0000-4000-8000-000000000001'$$);
select sec.t('S4','APP/SUB','subscribers','A_OWNER','self-assign Enterprise + credits + expiry','A','DENY_ERROR',
  $$update public.subscribers set subscription_tier='enterprise', ai_credits_limit=999999,
    subscription_end = now() + interval '10 years' where user_id='aaaaaaaa-0000-4000-8000-000000000001'$$);

-- S5: customer cannot mark a payment successful
select sec.t('S5','APP/SUB','payments','A_OWNER','UPDATE payment status to paid','A','DENY_ERROR',
  $$update public.payments set status='paid' where user_id='aaaaaaaa-0000-4000-8000-000000000001'$$);
select sec.t('S5','APP/SUB','payments','A_OWNER','INSERT fake paid payment','A','DENY_ERROR',
  $$insert into public.payments(user_id, customer_email, amount, item_name, status)
    values ('aaaaaaaa-0000-4000-8000-000000000001','a_owner@test.invalid',1,'forged','paid')$$);

-- S6/S12: cannot touch another tenant's subscription
select sec.t('S6','APP/SUB','subscribers','A_OWNER','UPDATE B subscription','B','DENY_ERROR',
  $$update public.subscribers set subscription_tier='free' where user_id='bbbbbbbb-0000-4000-8000-000000000001'$$);
select sec.t('S12','APP/SUB','subscribers','A_OWNER','SELECT B subscription','B','DENY',
  $$select 1 from public.subscribers where user_id='bbbbbbbb-0000-4000-8000-000000000001'$$);
select sec.t('S11','APP/SUB','subscribers','A_OWNER','spoof stripe_customer_id','A','DENY_ERROR',
  $$update public.subscribers set stripe_customer_id='cus_forged' where user_id='aaaaaaaa-0000-4000-8000-000000000001'$$);

-- S7: trusted server/webhook CAN create and update entitlement
select sec.t('S7','APP/SUB','subscribers','SERVICE','INSERT free row (signup/server path)','-','ALLOW',
  $$insert into public.subscribers(user_id, email, subscribed, subscription_tier)
    values ('dddddddd-0000-4000-8000-000000000001','unassigned@test.invalid',false,'free')$$);
select sec.t('S7','APP/SUB','subscribers','SERVICE','UPSERT verified paid entitlement','A','ALLOW',
  $$update public.subscribers set subscribed=true, subscription_tier='Premium',
    subscription_end = now() + interval '30 days' where user_id='aaaaaaaa-0000-4000-8000-000000000001'$$);
select sec.t('S9','APP/SUB','subscribers','SERVICE','cancellation via server path','A','ALLOW',
  $$update public.subscribers set subscribed=false, subscription_tier=null, subscription_end=null
    where user_id='aaaaaaaa-0000-4000-8000-000000000001'$$);
select sec.t('S7','APP/SUB','payments','SERVICE','webhook payment status update','A','ALLOW',
  $$update public.payments set status='paid' where user_id='aaaaaaaa-0000-4000-8000-000000000001'$$);

-- S8: useSubscription read path still works for the owner
select sec.t('S8','APP/SUB','subscribers','A_OWNER','SELECT own subscription','A','ALLOW',
  $$select 1 from public.subscribers where user_id='aaaaaaaa-0000-4000-8000-000000000001'$$);
select sec.t('S8','APP/SUB','get_ai_credits_info','A_OWNER','RPC own credits','A','ALLOW',
  $$select public.get_ai_credits_info('aaaaaaaa-0000-4000-8000-000000000001')$$);

-- S10: an unverified/absent payment grants nothing — a user with no subscriber
-- row cannot create one, and reads return zero rows (free tier by absence).
select sec.t('S10','APP/SUB','subscribers','UNASSIGNED','SELECT with no entitlement row','-','ZERO_ROWS',
  $$select 1 from public.subscribers where user_id='dddddddd-0000-4000-8000-000000000001'$$);

-- Anonymous visitors get nothing from subscribers (LivePurchaseNotification path)
select sec.t('S13','APP/SUB','subscribers','ANON','SELECT recent subscribers','-','DENY',
  $$select 1 from public.subscribers$$);

select verdict, count(*) from sec.results where phase like 'APP/%' group by 1 order by 1;
select test_no, resource, actor, action, expected, actual
from sec.results where phase like 'APP/%' and verdict = 'FAIL' order by seq;
