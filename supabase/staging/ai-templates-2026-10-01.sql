-- AI template generation: credit reservation, ledger, private templates, admin review, admin budget.
-- STAGING ONLY. Not applied to the live Supabase project. Rollback: ai-templates-2026-10-01-rollback.sql
-- Paid generation is DISABLED by default (paid_generation_enabled=false, prices NULL, budget cap 0).

begin;

-- 1. Single-row configuration (price and admin budget are server-owned, never sent by the browser)
create table public.ai_generation_config (
  id boolean primary key default true check (id),
  paid_generation_enabled boolean not null default false,
  customer_price_credits integer check (customer_price_credits is null or customer_price_credits between 1 and 100),
  admin_price_credits integer check (admin_price_credits is null or admin_price_credits between 1 and 100),
  admin_budget_cap integer not null default 0 check (admin_budget_cap >= 0),
  admin_budget_used integer not null default 0 check (admin_budget_used >= 0),
  admin_budget_period_start timestamptz not null default date_trunc('month', now()),
  reservation_ttl interval not null default interval '10 minutes',
  updated_by uuid,
  updated_at timestamptz not null default now()
);
insert into public.ai_generation_config default values;
grant select on public.ai_generation_config to authenticated;
grant all on public.ai_generation_config to service_role;
alter table public.ai_generation_config enable row level security;
create policy "Signed-in users can read AI generation config" on public.ai_generation_config
  for select to authenticated using (true);
create policy "Super admins can update AI generation config" on public.ai_generation_config
  for update to authenticated using (public.is_super_admin(auth.uid())) with check (public.is_super_admin(auth.uid()));
grant update (paid_generation_enabled, customer_price_credits, admin_price_credits, admin_budget_cap, reservation_ttl)
  on public.ai_generation_config to authenticated;

-- 2. Generation requests (idempotency key per user)
create table public.ai_generation_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  idempotency_key text not null check (length(idempotency_key) between 8 and 100),
  purpose text not null check (purpose in ('customer','admin_catalogue')),
  cost integer not null check (cost > 0),
  status text not null default 'reserved' check (status in ('reserved','settled','refunded')),
  failure_reason text check (failure_reason is null or length(failure_reason) <= 200),
  generated_template_id uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  finished_at timestamptz,
  unique (user_id, idempotency_key)
);
grant select on public.ai_generation_requests to authenticated;
grant all on public.ai_generation_requests to service_role;
alter table public.ai_generation_requests enable row level security;
create policy "Users read their own generation requests" on public.ai_generation_requests
  for select to authenticated using (user_id = auth.uid() or public.is_super_admin(auth.uid()));

-- 3. Append-only ledger (no prompt text stored)
create table public.ai_credit_ledger (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.ai_generation_requests(id) on delete restrict,
  user_id uuid not null,
  organization_id uuid not null,
  source text not null check (source in ('personal_credits','admin_budget')),
  entry text not null check (entry in ('reserve','settle','refund')),
  amount integer not null,
  balance_after integer,
  reason text check (reason is null or length(reason) <= 200),
  created_at timestamptz not null default now(),
  unique (request_id, entry)
);
grant select on public.ai_credit_ledger to authenticated;
grant all on public.ai_credit_ledger to service_role;
alter table public.ai_credit_ledger enable row level security;
create policy "Users read their own ledger entries" on public.ai_credit_ledger
  for select to authenticated using (user_id = auth.uid() or public.is_super_admin(auth.uid()));

-- 4. Generated templates (private by default; catalogue publication needs super-admin review)
create table public.generated_templates (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  scope text not null default 'account' check (scope in ('account','company')),
  schema_version integer not null check (schema_version = 1),
  name text not null check (length(name) between 1 and 80),
  definition jsonb not null check (jsonb_typeof(definition) = 'object' and pg_column_size(definition) <= 65536),
  review_status text not null default 'private' check (review_status in ('private','submitted','approved','rejected')),
  review_note text check (review_note is null or length(review_note) <= 500),
  reviewed_by uuid,
  reviewed_at timestamptz,
  source_request_id uuid references public.ai_generation_requests(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.generated_templates to authenticated;
grant all on public.generated_templates to service_role;
alter table public.generated_templates enable row level security;
create policy "Owners, company members (company scope) and super admins read" on public.generated_templates
  for select to authenticated using (
    owner_user_id = auth.uid()
    or (scope = 'company' and public.user_is_organization_member(organization_id, auth.uid()))
    or public.is_super_admin(auth.uid()));
create policy "Owners create private templates in their own company" on public.generated_templates
  for insert to authenticated with check (
    owner_user_id = auth.uid()
    and public.user_is_organization_member(organization_id, auth.uid())
    and review_status = 'private' and reviewed_by is null);
create policy "Owners edit their own unpublished templates" on public.generated_templates
  for update to authenticated
  using (owner_user_id = auth.uid() and review_status in ('private','rejected'))
  with check (owner_user_id = auth.uid() and review_status in ('private','rejected')
              and public.user_is_organization_member(organization_id, auth.uid()));
create policy "Owners delete their own unpublished templates" on public.generated_templates
  for delete to authenticated using (owner_user_id = auth.uid() and review_status <> 'approved');

-- 5. Functions. Reserve/settle/refund/expire: service_role only (called by the edge function).
create or replace function public.ai_reserve_generation(
  p_user uuid, p_org uuid, p_key text, p_purpose text)
returns json language plpgsql security definer set search_path = '' as $$
declare
  cfg public.ai_generation_config%rowtype;
  existing public.ai_generation_requests%rowtype;
  sub record;
  price integer;
  req_id uuid;
  bal integer;
begin
  if p_purpose not in ('customer','admin_catalogue') then raise exception 'invalid purpose'; end if;
  -- Idempotency first: a repeated key never charges again.
  select * into existing from public.ai_generation_requests where user_id = p_user and idempotency_key = p_key;
  if found then
    return json_build_object('ok', true, 'duplicate', true, 'request_id', existing.id, 'status', existing.status, 'cost', existing.cost);
  end if;
  if not public.user_is_organization_member(p_org, p_user) then
    return json_build_object('ok', false, 'error', 'not_company_member');
  end if;
  select * into cfg from public.ai_generation_config where id for update;
  if not cfg.paid_generation_enabled then
    return json_build_object('ok', false, 'error', 'generation_disabled');
  end if;

  if p_purpose = 'admin_catalogue' then
    if not public.is_super_admin(p_user) then return json_build_object('ok', false, 'error', 'not_admin'); end if;
    price := cfg.admin_price_credits;
    if price is null then return json_build_object('ok', false, 'error', 'price_not_set'); end if;
    if cfg.admin_budget_period_start < date_trunc('month', now()) then
      update public.ai_generation_config set admin_budget_used = 0, admin_budget_period_start = date_trunc('month', now()) where id;
      cfg.admin_budget_used := 0;
    end if;
    if cfg.admin_budget_cap - cfg.admin_budget_used < price then
      return json_build_object('ok', false, 'error', 'admin_budget_exhausted');
    end if;
    update public.ai_generation_config set admin_budget_used = admin_budget_used + price where id
      returning admin_budget_cap - admin_budget_used into bal;
  else
    price := cfg.customer_price_credits;
    if price is null then return json_build_object('ok', false, 'error', 'price_not_set'); end if;
    select * into sub from public.subscribers where user_id = p_user for update;
    if not found then return json_build_object('ok', false, 'error', 'insufficient_credits', 'credits_remaining', 0, 'cost', price); end if;
    if sub.ai_credits_reset_date is not null and sub.ai_credits_reset_date <= now() then
      update public.subscribers set ai_credits_remaining = ai_credits_limit, ai_credits_reset_date = now() + interval '1 month'
        where user_id = p_user returning * into sub;
    end if;
    if coalesce(sub.ai_credits_remaining, 0) < price then
      return json_build_object('ok', false, 'error', 'insufficient_credits', 'credits_remaining', coalesce(sub.ai_credits_remaining,0), 'cost', price);
    end if;
    update public.subscribers set ai_credits_remaining = ai_credits_remaining - price where user_id = p_user
      returning ai_credits_remaining into bal;
  end if;

  begin
    insert into public.ai_generation_requests(user_id, organization_id, idempotency_key, purpose, cost, expires_at)
      values (p_user, p_org, p_key, p_purpose, price, now() + cfg.reservation_ttl) returning id into req_id;
  exception when unique_violation then
    -- Concurrent identical key: the statement-level rollback of this block does not undo the debit above,
    -- so raise to abort the whole transaction (debit included); caller retries and sees the duplicate.
    raise exception 'duplicate_in_flight' using errcode = '40001';
  end;
  insert into public.ai_credit_ledger(request_id, user_id, organization_id, source, entry, amount, balance_after)
    values (req_id, p_user, p_org, case when p_purpose = 'admin_catalogue' then 'admin_budget' else 'personal_credits' end,
            'reserve', -price, bal);
  return json_build_object('ok', true, 'duplicate', false, 'request_id', req_id, 'status', 'reserved', 'cost', price, 'balance_after', bal);
end $$;

create or replace function public.ai_refund_generation(p_request uuid, p_reason text)
returns json language plpgsql security definer set search_path = '' as $$
declare r public.ai_generation_requests%rowtype; bal integer;
begin
  select * into r from public.ai_generation_requests where id = p_request for update;
  if not found then return json_build_object('ok', false, 'error', 'not_found'); end if;
  if r.status <> 'reserved' then return json_build_object('ok', true, 'status', r.status, 'refunded', false); end if;
  if r.purpose = 'admin_catalogue' then
    update public.ai_generation_config set admin_budget_used = greatest(admin_budget_used - r.cost, 0) where id
      returning admin_budget_cap - admin_budget_used into bal;
  else
    update public.subscribers set ai_credits_remaining = ai_credits_remaining + r.cost where user_id = r.user_id
      returning ai_credits_remaining into bal;
  end if;
  update public.ai_generation_requests set status = 'refunded', failure_reason = left(p_reason, 200), finished_at = now() where id = r.id;
  insert into public.ai_credit_ledger(request_id, user_id, organization_id, source, entry, amount, balance_after, reason)
    values (r.id, r.user_id, r.organization_id, case when r.purpose = 'admin_catalogue' then 'admin_budget' else 'personal_credits' end,
            'refund', r.cost, bal, left(p_reason, 200));
  return json_build_object('ok', true, 'status', 'refunded', 'refunded', true);
end $$;

-- Settle: only after the edge function validated the output. Stores a PRIVATE template.
create or replace function public.ai_settle_generation(p_request uuid, p_name text, p_definition jsonb)
returns json language plpgsql security definer set search_path = '' as $$
declare r public.ai_generation_requests%rowtype; tid uuid;
begin
  select * into r from public.ai_generation_requests where id = p_request for update;
  if not found then return json_build_object('ok', false, 'error', 'not_found'); end if;
  if r.status = 'settled' then return json_build_object('ok', true, 'template_id', r.generated_template_id, 'duplicate', true); end if;
  if r.status <> 'reserved' then return json_build_object('ok', false, 'error', 'not_reserved', 'status', r.status); end if;
  if r.expires_at < now() then
    perform public.ai_refund_generation(r.id, 'expired before settlement');
    return json_build_object('ok', false, 'error', 'expired');
  end if;
  if coalesce((p_definition->>'schemaVersion')::int, 0) <> 1 then
    perform public.ai_refund_generation(r.id, 'invalid output schema');
    return json_build_object('ok', false, 'error', 'invalid_output');
  end if;
  insert into public.generated_templates(owner_user_id, organization_id, schema_version, name, definition, source_request_id)
    values (r.user_id, r.organization_id, 1, left(p_name, 80), p_definition, r.id) returning id into tid;
  update public.ai_generation_requests set status = 'settled', generated_template_id = tid, finished_at = now() where id = r.id;
  insert into public.ai_credit_ledger(request_id, user_id, organization_id, source, entry, amount)
    values (r.id, r.user_id, r.organization_id, case when r.purpose = 'admin_catalogue' then 'admin_budget' else 'personal_credits' end, 'settle', 0);
  return json_build_object('ok', true, 'template_id', tid, 'duplicate', false);
end $$;

create or replace function public.ai_expire_stale_generations()
returns integer language plpgsql security definer set search_path = '' as $$
declare r record; n integer := 0;
begin
  for r in select id from public.ai_generation_requests where status = 'reserved' and expires_at < now() loop
    perform public.ai_refund_generation(r.id, 'reservation expired'); n := n + 1;
  end loop;
  return n;
end $$;

-- Customer: submit own template for catalogue review.
create or replace function public.submit_generated_template(p_template uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.generated_templates set review_status = 'submitted', updated_at = now()
    where id = p_template and owner_user_id = auth.uid() and review_status in ('private','rejected');
  return found;
end $$;

-- Super admin: approve/reject. Approval does not auto-publish; publishing into template_catalog stays a separate admin action.
create or replace function public.review_generated_template(p_template uuid, p_approve boolean, p_note text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_super_admin(auth.uid()) then raise exception 'Not authorized'; end if;
  update public.generated_templates
    set review_status = case when p_approve then 'approved' else 'rejected' end,
        review_note = left(p_note, 500), reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
    where id = p_template and review_status = 'submitted';
  return found;
end $$;

revoke all on function public.ai_reserve_generation(uuid,uuid,text,text), public.ai_refund_generation(uuid,text),
  public.ai_settle_generation(uuid,text,jsonb), public.ai_expire_stale_generations(),
  public.submit_generated_template(uuid), public.review_generated_template(uuid,boolean,text) from public, anon, authenticated;
grant execute on function public.ai_reserve_generation(uuid,uuid,text,text), public.ai_refund_generation(uuid,text),
  public.ai_settle_generation(uuid,text,jsonb), public.ai_expire_stale_generations() to service_role;
grant execute on function public.submit_generated_template(uuid), public.review_generated_template(uuid,boolean,text) to authenticated, service_role;

commit;
