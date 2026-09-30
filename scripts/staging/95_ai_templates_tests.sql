-- AI template generation: staging tests. Local disposable database only.
set client_min_messages = warning;
\ir ../../supabase/staging/ai-templates-2026-10-01.sql

create or replace function sec.ok(no text, target text, cond boolean, actual text) returns void language sql as $$
  insert into sec.results(test_no, phase, resource, actor, action, target, expected, actual, verdict, evidence)
  values (no, 'AI_TEMPLATES', 'ai_generation', 'SERVICE', 'CHECK', target, 'TRUE', actual,
          case when cond then 'PASS' else 'FAIL' end, 'direct assertion');
$$;

-- Seed personal credits (A_MEMBER 5, B_MEMBER 5, A_OWNER 1)
delete from public.subscribers where user_id in (sec.actor_uid('A_MEMBER'), sec.actor_uid('B_MEMBER'), sec.actor_uid('A_OWNER'));
insert into public.subscribers(user_id, email, subscribed, subscription_tier, ai_credits_limit, ai_credits_remaining, ai_credits_reset_date) values
  (sec.actor_uid('A_MEMBER'), 'a_member@test.invalid', true, 'starter', 250, 5, now() + interval '20 days'),
  (sec.actor_uid('B_MEMBER'), 'b_member@test.invalid', true, 'starter', 250, 5, now() + interval '20 days'),
  (sec.actor_uid('A_OWNER'),  'a_owner@test.invalid',  true, 'starter', 250, 1, now() + interval '20 days');

do $$
declare
  ORG_A uuid := '0a000000-0000-4000-8000-000000000001';
  ORG_B uuid := '0b000000-0000-4000-8000-000000000001';
  AM uuid := sec.actor_uid('A_MEMBER'); AO uuid := sec.actor_uid('A_OWNER');
  SA uuid := sec.actor_uid('SUPER_ADMIN');
  j json; j2 json; rid uuid; rid2 uuid; tid uuid; bal int; n int;
def_ok jsonb := '{"schemaVersion":1,"kind":"workspace","boards":[{"name":"Tickets","groups":[],"tasks":[]}]}';
begin
  -- Disabled by default
  j := public.ai_reserve_generation(AM, ORG_A, 'key-disabled-1', 'customer');
  perform sec.ok('AI-01','paid generation disabled by default', j->>'error' = 'generation_disabled', j::text);
  select ai_credits_remaining into bal from public.subscribers where user_id = AM;
  perform sec.ok('AI-02','no charge while disabled', bal = 5, 'bal='||bal);

  -- Enabled but no price set
  update public.ai_generation_config set paid_generation_enabled = true;
  j := public.ai_reserve_generation(AM, ORG_A, 'key-noprice-1', 'customer');
  perform sec.ok('AI-03','no price => refused', j->>'error' = 'price_not_set', j::text);

  update public.ai_generation_config set customer_price_credits = 2, admin_price_credits = 2, admin_budget_cap = 3;

  -- Cross-company
  j := public.ai_reserve_generation(AM, ORG_B, 'key-cross-001', 'customer');
  perform sec.ok('AI-04','reserve in other company refused', j->>'error' = 'not_company_member', j::text);

  -- Reserve + idempotent retry
  j := public.ai_reserve_generation(AM, ORG_A, 'key-happy-001', 'customer'); rid := (j->>'request_id')::uuid;
  select ai_credits_remaining into bal from public.subscribers where user_id = AM;
  perform sec.ok('AI-05','reserve deducts server price', (j->>'ok')::bool and bal = 3, j::text);
  j2 := public.ai_reserve_generation(AM, ORG_A, 'key-happy-001', 'customer');
  select ai_credits_remaining into bal from public.subscribers where user_id = AM;
  perform sec.ok('AI-06','retry with same key not charged again', (j2->>'duplicate')::bool and bal = 3 and (j2->>'request_id')::uuid = rid, j2::text);

  -- Settle valid output -> private template, settle ledger amount 0
  j := public.ai_settle_generation(rid, 'Support desk', def_ok); tid := (j->>'template_id')::uuid;
  perform sec.ok('AI-07','settle creates private template', (select review_status from public.generated_templates where id = tid) = 'private', j::text);
  j := public.ai_settle_generation(rid, 'Support desk', def_ok);
  perform sec.ok('AI-08','repeat settle returns same template, no new row',
    (j->>'duplicate')::bool and (select count(*) from public.generated_templates where source_request_id = rid) = 1, j::text);
  j := public.ai_refund_generation(rid, 'late refund attempt');
  select ai_credits_remaining into bal from public.subscribers where user_id = AM;
  perform sec.ok('AI-09','settled request cannot be refunded', not (j->>'refunded')::bool and bal = 3, j::text||' bal='||bal);

  -- Invalid output -> refund
  j := public.ai_reserve_generation(AM, ORG_A, 'key-invalid-01', 'customer'); rid := (j->>'request_id')::uuid;
  j := public.ai_settle_generation(rid, 'Bad', '{"schemaVersion":99}');
  select ai_credits_remaining into bal from public.subscribers where user_id = AM;
  perform sec.ok('AI-10','invalid output refunded', j->>'error' = 'invalid_output' and bal = 3, j::text||' bal='||bal);

  -- Provider failure -> refund, double refund idempotent
  j := public.ai_reserve_generation(AM, ORG_A, 'key-provfail-1', 'customer'); rid := (j->>'request_id')::uuid;
  perform public.ai_refund_generation(rid, 'provider error 500');
  j := public.ai_refund_generation(rid, 'provider error 500');
  select ai_credits_remaining into bal from public.subscribers where user_id = AM;
  perform sec.ok('AI-11','provider failure refunded once only', bal = 3 and not (j->>'refunded')::bool, 'bal='||bal);
  perform sec.ok('AI-12','ledger has one refund per request', (select count(*) from public.ai_credit_ledger where request_id = rid and entry='refund') = 1, 'ok');

  -- Timeout: stale reservation expired and refunded
  j := public.ai_reserve_generation(AM, ORG_A, 'key-timeout-01', 'customer'); rid := (j->>'request_id')::uuid;
  update public.ai_generation_requests set expires_at = now() - interval '1 minute' where id = rid;
  j := public.ai_settle_generation(rid, 'Late', def_ok);
  select ai_credits_remaining into bal from public.subscribers where user_id = AM;
  perform sec.ok('AI-13','expired reservation refunded, not settled', j->>'error' = 'expired' and bal = 3, j::text||' bal='||bal);
  j := public.ai_reserve_generation(AM, ORG_A, 'key-timeout-02', 'customer'); rid := (j->>'request_id')::uuid;
  update public.ai_generation_requests set expires_at = now() - interval '1 minute' where id = rid;
  n := public.ai_expire_stale_generations();
  select ai_credits_remaining into bal from public.subscribers where user_id = AM;
  perform sec.ok('AI-14','expiry sweep refunds stale reservations', n = 1 and bal = 3, 'n='||n||' bal='||bal);

  -- Insufficient credits
  j := public.ai_reserve_generation(AO, ORG_A, 'key-poor-0001', 'customer');
  perform sec.ok('AI-15','insufficient credits refused, balance unchanged',
    j->>'error' = 'insufficient_credits' and (select ai_credits_remaining from public.subscribers where user_id = AO) = 1, j::text);

  -- Admin budget: non-admin refused, cap enforced, separate from personal credits
  j := public.ai_reserve_generation(AM, ORG_A, 'key-admin-nope', 'admin_catalogue');
  perform sec.ok('AI-16','non-admin cannot use admin budget', j->>'error' = 'not_admin', j::text);
  -- ensure super admin is a member of org A for the admin path
  insert into public.organization_members(organization_id, user_id, role) values (ORG_A, SA, 'member') on conflict do nothing;
  j := public.ai_reserve_generation(SA, ORG_A, 'key-admin-0001', 'admin_catalogue');
  j2 := public.ai_reserve_generation(SA, ORG_A, 'key-admin-0002', 'admin_catalogue');
  perform sec.ok('AI-17','admin budget cap enforced (cap 3, price 2)', (j->>'ok')::bool and j2->>'error' = 'admin_budget_exhausted', j::text||' | '||j2::text);
  perform sec.ok('AI-18','admin generation never touches personal credits',
    (select source from public.ai_credit_ledger where request_id = (j->>'request_id')::uuid and entry='reserve') = 'admin_budget', 'ok');
  perform public.ai_refund_generation((j->>'request_id')::uuid, 'test');
  perform sec.ok('AI-19','admin refund restores budget', (select admin_budget_used from public.ai_generation_config) = 0, 'ok');
end $$;

-- Permissions via simulated sessions
do $$
declare ORG_A text := '0a000000-0000-4000-8000-000000000001'; ORG_B text := '0b000000-0000-4000-8000-000000000001';
begin
perform sec.t('AI-20','AI_TEMPLATES','ai_reserve_generation','A_MEMBER','EXECUTE','customer calls reserve directly','DENY_ERROR',
  format('select public.ai_reserve_generation(sec.actor_uid(''A_MEMBER''), %L, ''key-direct-01'', ''customer'')', ORG_A));
perform sec.t('AI-21','AI_TEMPLATES','ai_refund_generation','A_MEMBER','EXECUTE','customer self-refund','DENY_ERROR',
  'select public.ai_refund_generation(gen_random_uuid(), ''x'')');
perform sec.t('AI-22','AI_TEMPLATES','ai_generation_requests','ANON','SELECT','anon read','DENY_ERROR','select 1 from public.ai_generation_requests');
perform sec.t('AI-23','AI_TEMPLATES','ai_credit_ledger','ANON','SELECT','anon read','DENY_ERROR','select 1 from public.ai_credit_ledger');
perform sec.t('AI-24','AI_TEMPLATES','ai_credit_ledger','A_MEMBER','SELECT','own ledger','ALLOW','select 1 from public.ai_credit_ledger where user_id = sec.actor_uid(''A_MEMBER'')');
perform sec.t('AI-25','AI_TEMPLATES','ai_credit_ledger','B_MEMBER','SELECT','other user ledger','ZERO_ROWS','select 1 from public.ai_credit_ledger where user_id = sec.actor_uid(''A_MEMBER'')');
perform sec.t('AI-26','AI_TEMPLATES','ai_credit_ledger','A_MEMBER','INSERT','forge ledger entry','DENY_ERROR',
  format('insert into public.ai_credit_ledger(request_id,user_id,organization_id,source,entry,amount) select id,user_id,organization_id,''personal_credits'',''settle'',0 from public.ai_generation_requests limit 1'));
perform sec.t('AI-27','AI_TEMPLATES','ai_generation_config','A_MEMBER','UPDATE','customer changes price','ZERO_ROWS','update public.ai_generation_config set customer_price_credits = 1');
perform sec.t('AI-28','AI_TEMPLATES','ai_generation_config','A_ADMIN','UPDATE','company admin raises admin budget','ZERO_ROWS','update public.ai_generation_config set admin_budget_cap = 99999');
perform sec.t('AI-29','AI_TEMPLATES','ai_generation_config','SUPER_ADMIN','UPDATE','super admin sets budget cap','ALLOW','update public.ai_generation_config set admin_budget_cap = 10');
perform sec.t('AI-30','AI_TEMPLATES','ai_generation_config','SUPER_ADMIN','UPDATE','super admin cannot fake budget used','DENY_ERROR','update public.ai_generation_config set admin_budget_used = 0');
-- Generated templates isolation
perform sec.t('AI-31','AI_TEMPLATES','generated_templates','A_MEMBER','SELECT','own private template','ALLOW','select 1 from public.generated_templates where owner_user_id = sec.actor_uid(''A_MEMBER'')');
perform sec.t('AI-32','AI_TEMPLATES','generated_templates','A_OWNER','SELECT','colleague private template','ZERO_ROWS','select 1 from public.generated_templates where owner_user_id = sec.actor_uid(''A_MEMBER'')');
perform sec.t('AI-33','AI_TEMPLATES','generated_templates','B_MEMBER','SELECT','other company template','ZERO_ROWS','select 1 from public.generated_templates where owner_user_id = sec.actor_uid(''A_MEMBER'')');
perform sec.t('AI-34','AI_TEMPLATES','generated_templates','A_MEMBER','INSERT','save into other company','DENY_ERROR',
  format('insert into public.generated_templates(owner_user_id, organization_id, schema_version, name, definition) values (sec.actor_uid(''A_MEMBER''), %L, 1, ''x'', ''{"schemaVersion":1}'')', ORG_B));
perform sec.t('AI-35','AI_TEMPLATES','generated_templates','A_MEMBER','INSERT','self-approve on insert','DENY_ERROR',
  format('insert into public.generated_templates(owner_user_id, organization_id, schema_version, name, definition, review_status) values (sec.actor_uid(''A_MEMBER''), %L, 1, ''x'', ''{"schemaVersion":1}'', ''approved'')', ORG_A));
perform sec.t('AI-36','AI_TEMPLATES','generated_templates','A_MEMBER','UPDATE','self-approve by update','DENY_ERROR',
  'update public.generated_templates set review_status = ''approved'' where owner_user_id = sec.actor_uid(''A_MEMBER'')');
perform sec.t('AI-37','AI_TEMPLATES','generated_templates','A_OWNER','UPDATE','company-scope share by colleague','ZERO_ROWS',
  'update public.generated_templates set scope = ''company'' where owner_user_id = sec.actor_uid(''A_MEMBER'')');
perform sec.t('AI-38','AI_TEMPLATES','submit_generated_template','A_MEMBER','EXECUTE','owner submits for review','ALLOW',
  'select public.submit_generated_template(id) from public.generated_templates where owner_user_id = sec.actor_uid(''A_MEMBER'')');
perform sec.t('AI-39','AI_TEMPLATES','review_generated_template','A_OWNER','EXECUTE','company owner approves catalogue entry','DENY_ERROR',
  'select public.review_generated_template(id, true, null) from public.generated_templates');
end $$;

-- Stateful review flow (as simulated users, committed)
select set_config('request.jwt.claims', json_build_object('sub', sec.actor_uid('A_MEMBER'), 'role','authenticated')::text, false);
set role authenticated;
select public.submit_generated_template(id) from public.generated_templates where owner_user_id = sec.actor_uid('A_MEMBER');
reset role;
select set_config('request.jwt.claims', json_build_object('sub', sec.actor_uid('SUPER_ADMIN'), 'role','authenticated')::text, false);
set role authenticated;
select public.review_generated_template(id, true, 'ok') from public.generated_templates where review_status = 'submitted';
reset role;
select set_config('request.jwt.claims', '', false);
select sec.ok('AI-40','super admin approval recorded with reviewer',
  exists(select 1 from public.generated_templates where review_status='approved' and reviewed_by = sec.actor_uid('SUPER_ADMIN')), 'ok');
select sec.ok('AI-41','approved template cannot be edited by owner',
  sec.exec('A_MEMBER','update public.generated_templates set name = ''x'' where owner_user_id = sec.actor_uid(''A_MEMBER'')') = 'ROWS=0', 'ok');
-- Leave generation enabled with price 2 for the concurrency check in the runner.
update public.ai_generation_config set paid_generation_enabled = true, customer_price_credits = 2;
update public.subscribers set ai_credits_remaining = 3 where user_id = sec.actor_uid('B_MEMBER');
