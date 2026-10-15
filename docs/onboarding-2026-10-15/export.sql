-- Run before rollback (service role / SQL editor). Save the JSON privately: contains emails, feedback comments.
SELECT json_build_object(
  'exported_at', now(),
  'staff_invitations', (SELECT coalesce(json_agg(json_build_object('id',id,'organization_id',organization_id,'email',email,'role',role,
       'expires_at',expires_at,'accepted_at',accepted_at,'accepted_by',accepted_by,'revoked_at',revoked_at,'created_at',created_at)),'[]') FROM public.organization_invitations),
  'invitation_emails', (SELECT coalesce(json_agg(row_to_json(o)),'[]') FROM public.onboarding_email_outbox o),
  'notification_prefs', (SELECT coalesce(json_agg(row_to_json(p)),'[]') FROM public.support_notification_prefs p),
  'feedback', (SELECT coalesce(json_agg(row_to_json(f)),'[]') FROM public.support_ticket_feedback f),
  'feedback_enabled', (SELECT coalesce(json_agg(json_build_object('organization_id',organization_id,'feedback_enabled',feedback_enabled)),'[]') FROM public.support_settings),
  'status_emails', (SELECT coalesce(json_agg(row_to_json(e)),'[]') FROM public.support_email_outbox e WHERE kind='status_change'));
