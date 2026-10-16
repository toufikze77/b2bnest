-- These SECURITY DEFINER functions take a user id from the caller and are
-- executable by every signed-in user, but never checked that the id is the
-- caller's own. Any user could:
--   check_trial_status           read another user's trial and flip it to expired
--   get_notification_preferences read (and create) another user's preferences
--   log_user_action              write audit_logs rows attributed to another user
--   ensure_user_has_org          create an organization owned by another user
-- Add the same public.assert_self guard the token/banking functions use.
-- assert_self lets service_role/postgres through, so server paths are unaffected.
-- Bodies are otherwise unchanged from production; CREATE OR REPLACE keeps grants.

create or replace function public.check_trial_status(user_id_param uuid)
returns table(is_trial_active boolean, trial_expired boolean, days_remaining integer, trial_ends_at timestamptz)
language plpgsql security definer set search_path to ''
as $$
declare
  profile_record record;
  days_left integer;
begin
  perform public.assert_self(user_id_param);

  select * into profile_record from public.profiles where id = user_id_param;
  if not found then
    return;
  end if;

  days_left := extract(day from (profile_record.trial_ends_at - now()));

  if now() > profile_record.trial_ends_at and profile_record.is_trial_active then
    update public.profiles set is_trial_active = false, trial_expired = true where id = user_id_param;
    profile_record.is_trial_active := false;
    profile_record.trial_expired := true;
  end if;

  return query select
    profile_record.is_trial_active,
    profile_record.trial_expired,
    greatest(0, days_left),
    profile_record.trial_ends_at;
end;
$$;

create or replace function public.get_notification_preferences(p_user_id uuid default auth.uid())
returns table(email_task_assigned boolean, email_task_completed boolean, email_task_status_changed boolean, email_task_due_reminder boolean, email_task_overdue boolean, email_task_comment boolean, email_project_update boolean, email_weekly_digest boolean, due_reminder_hours integer)
language plpgsql security definer set search_path to ''
as $$
begin
  perform public.assert_self(p_user_id);

  insert into public.user_notification_preferences (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  return query
  select np.email_task_assigned, np.email_task_completed, np.email_task_status_changed,
         np.email_task_due_reminder, np.email_task_overdue, np.email_task_comment,
         np.email_project_update, np.email_weekly_digest, np.due_reminder_hours
  from public.user_notification_preferences np
  where np.user_id = p_user_id;
end;
$$;

create or replace function public.log_user_action(p_user_id uuid, p_action text, p_resource_type text, p_resource_id text default null, p_details jsonb default null, p_ip_address inet default null, p_user_agent text default null)
returns uuid
language plpgsql security definer set search_path to ''
as $$
declare
  log_id uuid;
begin
  perform public.assert_self(p_user_id);

  insert into public.audit_logs (user_id, action, resource_type, resource_id, details, ip_address, user_agent)
  values (p_user_id, p_action, p_resource_type, p_resource_id, p_details, p_ip_address, p_user_agent)
  returning id into log_id;

  return log_id;
end;
$$;

create or replace function public.ensure_user_has_org(p_user_id uuid default auth.uid())
returns uuid
language plpgsql security definer set search_path to ''
as $$
declare
  org_id uuid;
  fname text;
begin
  perform public.assert_self(p_user_id);

  select om.organization_id into org_id
  from public.organization_members om
  where om.user_id = p_user_id and om.is_active = true
  limit 1;

  if org_id is not null then
    return org_id;
  end if;

  select coalesce(pr.display_name, pr.full_name, split_part(pr.email, '@', 1)) into fname
  from public.profiles pr where pr.id = p_user_id;

  if fname is null then
    select split_part(u.email, '@', 1) into fname from auth.users u where u.id = p_user_id;
  end if;

  insert into public.organizations (name, slug, created_by)
  values (
    fname || '''s Organization',
    lower(replace(fname, ' ', '-')) || '-org-' || floor(extract(epoch from now()))::text || '-' || substr(p_user_id::text, 1, 8),
    p_user_id
  ) returning id into org_id;

  insert into public.organization_members (organization_id, user_id, role, is_active)
  values (org_id, p_user_id, 'owner', true);

  return org_id;
end;
$$;
