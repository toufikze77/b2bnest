-- ============================================================================
-- B2BNest — SECURITY REMEDIATION ROUND 2 (2026-09)
-- Prepared and validated in the ISOLATED local staging environment ONLY.
-- NOT APPLIED TO PRODUCTION. Idempotent; safe to re-run.
--
-- Fixes: anonymous NULL-guard bypasses, PUBLIC/anon EXECUTE on SECURITY DEFINER
-- functions, encrypt_/decrypt_ exposure, cross-tenant documents SELECT,
-- cross-tenant projects INSERT, subscriber self-escalation, AI-credit RPC,
-- profile PII RPC, tenant-membership probing, and two functional defects.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 0. Shared authorization guard (fails closed for anonymous callers)
-- ---------------------------------------------------------------------------
create or replace function public.assert_self(p_user_id uuid)
returns void
language plpgsql
stable
security definer
set search_path to ''
as $$
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
$$;
revoke all on function public.assert_self(uuid) from public;
grant execute on function public.assert_self(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 1/2. NULL-guard bypasses in sensitive accessor RPCs
--      (p_user_id <> auth.uid() evaluates to NULL for anon -> IF skipped)
--      Global admin bypass (is_admin_or_owner) removed from credential paths.
-- ---------------------------------------------------------------------------
create or replace function public.get_hmrc_tokens(p_user_id uuid default auth.uid())
returns table(access_token text, refresh_token text, expires_at timestamptz)
language plpgsql security definer set search_path to ''
as $$
begin
  perform public.assert_self(p_user_id);
  return query
    select h.access_token, h.refresh_token, h.expires_at
    from public.hmrc_integrations h
    where h.user_id = p_user_id and h.is_connected = true;
end;
$$;

create or replace function public.get_user_integrations_safe(p_user_id uuid default auth.uid())
returns table(id uuid, user_id uuid, integration_name text, is_connected boolean,
              connected_at timestamptz, expires_at timestamptz, metadata jsonb,
              created_at timestamptz, updated_at timestamptz,
              has_access_token boolean, has_refresh_token boolean)
language plpgsql security definer set search_path to ''
as $$
begin
  perform public.assert_self(p_user_id);
  insert into public.integration_audit_logs (user_id, integration_name, action, ip_address)
  values (p_user_id, 'all_integrations', 'safe_access', inet_client_addr());
  return query
    select ui.id, ui.user_id, ui.integration_name, ui.is_connected, ui.connected_at,
           ui.expires_at, ui.metadata, ui.created_at, ui.updated_at,
           (ui.access_token is not null), (ui.refresh_token is not null)
    from public.user_integrations ui
    where ui.user_id = p_user_id
    order by ui.created_at desc;
end;
$$;

create or replace function public.get_integration_tokens(p_integration_name text, p_user_id uuid default auth.uid())
returns table(access_token text, refresh_token text, expires_at timestamptz)
language plpgsql security definer set search_path to ''
as $$
begin
  perform public.assert_self(p_user_id);
  insert into public.integration_audit_logs (user_id, integration_name, action, ip_address)
  values (p_user_id, p_integration_name, 'token_accessed', inet_client_addr());
  return query
    select public.decrypt_integration_token(ui.access_token),
           public.decrypt_integration_token(ui.refresh_token),
           ui.expires_at
    from public.user_integrations ui
    where ui.user_id = p_user_id and ui.integration_name = p_integration_name and ui.is_connected = true;
end;
$$;

create or replace function public.get_bank_accounts_safe(p_user_id uuid default auth.uid())
returns table(id uuid, account_id text, provider_name text, account_type text, currency text,
              balance numeric, available_balance numeric, last_synced_at timestamptz,
              is_active boolean, created_at timestamptz)
language plpgsql security definer set search_path to ''
as $$
begin
  perform public.assert_self(p_user_id);
  insert into public.banking_audit_logs (user_id, action, ip_address)
  values (p_user_id, 'accounts_accessed', inet_client_addr());
  return query
    select ba.id, ba.account_id, ba.provider_name, ba.account_type, ba.currency,
           ba.balance, ba.available_balance, ba.last_synced_at, ba.is_active, ba.created_at
    from public.bank_accounts ba
    where ba.user_id = p_user_id and ba.is_active = true
    order by ba.created_at desc;
end;
$$;

create or replace function public.get_bank_account_details(p_account_id uuid, p_user_id uuid default auth.uid())
returns table(account_number text, sort_code text)
language plpgsql security definer set search_path to ''
as $$
begin
  perform public.assert_self(p_user_id);
  if not exists (select 1 from public.bank_accounts where id = p_account_id and user_id = p_user_id) then
    raise exception 'Access denied: Account not found or not owned by user' using errcode = '42501';
  end if;
  insert into public.banking_audit_logs (user_id, bank_account_id, action, ip_address)
  values (p_user_id, p_account_id, 'sensitive_details_accessed', inet_client_addr());
  return query
    select public.decrypt_banking_data(ba.account_number), public.decrypt_banking_data(ba.sort_code)
    from public.bank_accounts ba
    where ba.id = p_account_id and ba.user_id = p_user_id;
end;
$$;

create or replace function public.get_hmrc_client_secret(p_user_id uuid default auth.uid())
returns text
language plpgsql security definer set search_path to ''
as $$
declare v_secret text;
begin
  perform public.assert_self(p_user_id);
  select client_secret into v_secret from public.hmrc_settings where user_id = p_user_id limit 1;
  return public.decrypt_hmrc_token(v_secret);
end;
$$;

create or replace function public.store_integration_tokens(
  p_integration_name text, p_access_token text, p_refresh_token text default null,
  p_expires_at timestamptz default null, p_metadata jsonb default '{}'::jsonb,
  p_user_id uuid default auth.uid())
returns uuid
language plpgsql security definer set search_path to ''
as $$
declare integration_id uuid; enc_access text; enc_refresh text;
begin
  perform public.assert_self(p_user_id);
  enc_access := public.encrypt_integration_token(p_access_token);
  enc_refresh := case when p_refresh_token is not null then public.encrypt_integration_token(p_refresh_token) end;
  insert into public.user_integrations (user_id, integration_name, access_token, refresh_token,
                                        expires_at, metadata, is_connected, connected_at)
  values (p_user_id, p_integration_name, enc_access, enc_refresh, p_expires_at, p_metadata, true, now())
  on conflict (user_id, integration_name) do update set
    access_token = excluded.access_token, refresh_token = excluded.refresh_token,
    expires_at = excluded.expires_at, metadata = excluded.metadata,
    is_connected = excluded.is_connected, connected_at = excluded.connected_at, updated_at = now()
  returning id into integration_id;
  insert into public.integration_audit_logs (user_id, integration_name, action, ip_address)
  values (p_user_id, p_integration_name, 'token_created', inet_client_addr());
  return integration_id;
end;
$$;

create or replace function public.store_bank_account(
  p_account_id text, p_provider_id text, p_provider_name text, p_account_type text,
  p_account_number text default null, p_sort_code text default null, p_currency text default 'GBP',
  p_balance numeric default null, p_available_balance numeric default null,
  p_user_id uuid default auth.uid())
returns uuid
language plpgsql security definer set search_path to ''
as $$
declare bank_account_id uuid; enc_number text; enc_sort text;
begin
  perform public.assert_self(p_user_id);
  enc_number := case when p_account_number is not null then public.encrypt_banking_data(p_account_number) end;
  enc_sort := case when p_sort_code is not null then public.encrypt_banking_data(p_sort_code) end;
  insert into public.bank_accounts (user_id, account_id, provider_id, provider_name, account_type,
                                    account_number, sort_code, currency, balance, available_balance, is_active)
  values (p_user_id, p_account_id, p_provider_id, p_provider_name, p_account_type,
          enc_number, enc_sort, p_currency, p_balance, p_available_balance, true)
  on conflict (user_id, account_id) do update set
    provider_name = excluded.provider_name, account_type = excluded.account_type,
    account_number = excluded.account_number, sort_code = excluded.sort_code,
    currency = excluded.currency, balance = excluded.balance,
    available_balance = excluded.available_balance, updated_at = now()
  returning id into bank_account_id;
  insert into public.banking_audit_logs (user_id, bank_account_id, action, ip_address)
  values (p_user_id, bank_account_id, 'account_stored', inet_client_addr());
  return bank_account_id;
end;
$$;

-- FIX 11: functional defect — search_path='' + unqualified helper; also strict self guard
create or replace function public.get_user_payments(p_user_id uuid default auth.uid())
returns table(id uuid, stripe_session_id text, amount integer, currency text, status text,
              item_name text, payment_method text, created_at timestamptz, updated_at timestamptz)
language plpgsql security definer set search_path to ''
as $$
begin
  perform public.assert_self(p_user_id);
  insert into public.payment_audit_logs (user_id, action, ip_address)
  values (p_user_id, 'payments_accessed', inet_client_addr());
  return query
    select p.id, p.stripe_session_id, p.amount, p.currency, p.status, p.item_name,
           p.payment_method, p.created_at, p.updated_at
    from public.payments p where p.user_id = p_user_id order by p.created_at desc;
end;
$$;

-- admin payment PII: platform super-admin only (was legacy is_admin_or_owner)
create or replace function public.get_payment_details_admin(p_payment_id uuid)
returns table(id uuid, stripe_session_id text, customer_email text, customer_name text,
              company_name text, contact_number text, amount integer, currency text,
              status text, item_name text, payment_method text, created_at timestamptz)
language plpgsql security definer set search_path to ''
as $$
begin
  if auth.uid() is null or not public.is_super_admin(auth.uid()) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  insert into public.payment_audit_logs (payment_id, action, ip_address, admin_user_id)
  values (p_payment_id, 'admin_details_accessed', inet_client_addr(), auth.uid());
  return query
    select p.id, p.stripe_session_id,
           public.decrypt_payment_data(p.customer_email), public.decrypt_payment_data(p.customer_name),
           public.decrypt_payment_data(p.company_name), public.decrypt_payment_data(p.contact_number),
           p.amount, p.currency, p.status, p.item_name, p.payment_method, p.created_at
    from public.payments p where p.id = p_payment_id;
end;
$$;

-- FIX 8: AI credits — explicit anonymous rejection (guard was correct but grant was open)
create or replace function public.get_ai_credits_info(p_user_id uuid default auth.uid())
returns json language plpgsql security definer set search_path to ''
as $$
declare v_subscriber record;
begin
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
$$;

-- FIX 9: profile display info — authenticated only, minimum fields, no email
create or replace function public.get_user_display_info(p_user_id uuid)
returns table(id uuid, display_name text, avatar_url text, headline text)
language plpgsql stable security definer set search_path to ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  return query
    select pp.id, pp.display_name, pp.avatar_url, pp.headline
    from public.public_profiles pp
    where pp.id = p_user_id
      and (pp.id = auth.uid()
           or public.users_share_organization(auth.uid(), pp.id)
           or public.is_super_admin(auth.uid()))
    limit 1;
end;
$$;

-- FIX 12 (functional): owners may delete their own rows
drop policy if exists "Team owners can delete their teams" on public.teams;
create policy "Team owners can delete their teams" on public.teams
  for delete to authenticated using (owner_id = auth.uid());

drop policy if exists "ai_conversations_delete_policy" on public.ai_conversations;
create policy "ai_conversations_delete_policy" on public.ai_conversations
  for delete to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 3/4. Least-privilege EXECUTE across every function in public
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;

-- (E) intentionally anonymous-callable
grant execute on function public.get_invitation_by_token(text) to anon, authenticated;
grant execute on function public.template_usage_counts() to anon, authenticated;

-- RLS helper predicates: evaluated inside policies that target role `public`,
-- so both anon and authenticated need EXECUTE. All are boolean membership checks.
grant execute on function
  public.has_role(uuid, public.app_role),
  public.is_super_admin(uuid),
  public.is_admin_or_owner(uuid),
  public.is_safe_profile_field(text),
  public.is_project_member(uuid, uuid),
  public.is_team_member(uuid, uuid),
  public.owns_team(uuid, uuid),
  public.user_owns_project(uuid, uuid),
  public.user_can_access_project(uuid, uuid),
  public.user_is_organization_member(uuid, uuid),
  public.user_is_organization_admin(uuid, uuid),
  public.user_is_organization_owner(uuid, uuid)
to anon, authenticated;

-- (A) client-callable authenticated RPCs
grant execute on function
  public.get_hmrc_tokens(uuid),
  public.get_hmrc_client_secret(uuid),
  public.get_user_integrations_safe(uuid),
  public.get_integration_tokens(text, uuid),
  public.store_integration_tokens(text, text, text, timestamptz, jsonb, uuid),
  public.get_bank_accounts_safe(uuid),
  public.get_bank_account_details(uuid, uuid),
  public.store_bank_account(text, text, text, text, text, text, text, numeric, numeric, uuid),
  public.get_user_payments(uuid),
  public.get_ai_credits_info(uuid),
  public.check_and_deduct_ai_credit(uuid, integer),
  public.get_user_display_info(uuid),
  public.users_share_organization(uuid, uuid),
  public.get_user_projects(uuid),
  public.get_user_teams(uuid),
  public.get_team_members_with_profiles(uuid),
  public.add_project_member(uuid, uuid, text),
  public.add_team_member(uuid, uuid, text),
  public.create_team_with_owner(text),
  public.ensure_user_has_org(uuid),
  public.check_trial_status(uuid),
  public.get_notification_preferences(uuid),
  public.get_advertisement_contact_info(uuid),
  public.get_user_staking_tier(uuid),
  public.preview_user_emissions(uuid),
  public.rota_can_add_employee(uuid),
  public.log_user_action(uuid, text, text, text, jsonb, inet, text),
  public.audit_profile_access(uuid, text)
to authenticated;

-- (D) super-admin RPCs: restricted grant AND in-function is_super_admin() guard
do $$
declare r record;
begin
  for r in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='public' and p.proname like 'admin\_%'
  loop
    execute format('grant execute on function %s to authenticated', r.sig);
  end loop;
end $$;

-- (B/C) encrypt_*/decrypt_*, payment writers, 2FA maintenance and trigger helpers stay
-- service_role-only (already revoked above; no client grant is issued).

-- ---------------------------------------------------------------------------
-- 5. documents — stop cross-tenant reads of free rows
-- ---------------------------------------------------------------------------
alter table public.documents add column if not exists is_public boolean not null default false;

-- only platform-published free rows (authored by a super admin) stay world-readable
update public.documents d
set is_public = true
where coalesce(d.price, 0) = 0
  and exists (select 1 from public.user_roles ur where ur.user_id = d.user_id and ur.role = 'super_admin');

drop policy if exists "documents_select_owned_purchased_or_free" on public.documents;
drop policy if exists "documents_select_owned_purchased_or_public" on public.documents;
create policy "documents_select_owned_purchased_or_public" on public.documents
  for select to authenticated
  using (
    auth.uid() = user_id
    or public.is_super_admin(auth.uid())
    or (is_public = true and coalesce(price, 0) = 0)
    or exists (select 1 from public.user_documents ud
               where ud.document_id = documents.id and ud.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 6. projects — INSERT/UPDATE must prove organization membership
-- ---------------------------------------------------------------------------
drop policy if exists "Users can create their own projects" on public.projects;
create policy "Users can create their own projects" on public.projects
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and (organization_id is null or public.user_is_organization_member(organization_id, auth.uid()))
  );

drop policy if exists "Organization members can create projects" on public.projects;
create policy "Organization members can create projects" on public.projects
  for insert to authenticated
  with check (
    organization_id is not null
    and public.user_is_organization_member(organization_id, auth.uid())
  );

drop policy if exists "Users can update projects they own" on public.projects;
create policy "Users can update projects they own" on public.projects
  for update to authenticated
  using (public.user_owns_project(id, auth.uid()))
  with check (organization_id is null or public.user_is_organization_member(organization_id, auth.uid()));

drop policy if exists "Project owners can update projects" on public.projects;
create policy "Project owners can update projects" on public.projects
  for update to authenticated
  using (
    user_id = auth.uid()
    or (organization_id is not null and public.user_is_organization_admin(organization_id, auth.uid()))
  )
  with check (organization_id is null or public.user_is_organization_member(organization_id, auth.uid()));

-- same pattern on user-scoped tables that also carry organization_id
drop policy if exists "Users can insert their own HMRC integrations" on public.hmrc_integrations;
create policy "Users can insert their own HMRC integrations" on public.hmrc_integrations
  for insert to authenticated
  with check (auth.uid() = user_id
    and (organization_id is null or public.user_is_organization_member(organization_id, auth.uid())));

drop policy if exists "Users can update their own HMRC integrations" on public.hmrc_integrations;
create policy "Users can update their own HMRC integrations" on public.hmrc_integrations
  for update to authenticated using (auth.uid() = user_id)
  with check (auth.uid() = user_id
    and (organization_id is null or public.user_is_organization_member(organization_id, auth.uid())));

drop policy if exists "Users can insert their own HMRC settings" on public.hmrc_settings;
create policy "Users can insert their own HMRC settings" on public.hmrc_settings
  for insert to authenticated
  with check (auth.uid() = user_id
    and (organization_id is null or public.user_is_organization_member(organization_id, auth.uid())));

drop policy if exists "Users can update their own HMRC settings" on public.hmrc_settings;
create policy "Users can update their own HMRC settings" on public.hmrc_settings
  for update to authenticated using (auth.uid() = user_id)
  with check (auth.uid() = user_id
    and (organization_id is null or public.user_is_organization_member(organization_id, auth.uid())));

drop policy if exists "Users can insert their own HMRC submission logs" on public.hmrc_submission_logs;
create policy "Users can insert their own HMRC submission logs" on public.hmrc_submission_logs
  for insert to authenticated
  with check (auth.uid() = user_id
    and (organization_id is null or public.user_is_organization_member(organization_id, auth.uid())));

-- ---------------------------------------------------------------------------
-- 7. subscribers — entitlement state becomes server-controlled
-- ---------------------------------------------------------------------------
drop policy if exists "insert_subscription" on public.subscribers;
drop policy if exists "update_own_subscription" on public.subscribers;
drop policy if exists "select_own_subscription" on public.subscribers;
create policy "select_own_subscription" on public.subscribers
  for select to authenticated
  using (user_id = auth.uid() or email = auth.email());

revoke insert, update, delete on public.subscribers from anon, authenticated;
revoke all on public.subscribers from anon;
grant select on public.subscribers to authenticated;
grant all on public.subscribers to service_role;

-- payments: no client writes at all (records are created by the payment webhook)
drop policy if exists "Users can insert their own payments" on public.payments;
revoke insert, update, delete on public.payments from anon, authenticated;
grant select on public.payments to authenticated;
grant all on public.payments to service_role;

commit;
