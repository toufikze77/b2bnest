-- Run before any rollback (service role / SQL editor). Saves all support records as one JSON value.
SELECT json_build_object(
  'settings',(SELECT coalesce(json_agg(x),'[]') FROM public.support_settings x),
  'categories',(SELECT coalesce(json_agg(x),'[]') FROM public.support_categories x),
  'agents',(SELECT coalesce(json_agg(x),'[]') FROM public.support_agents x),
  'customers',(SELECT coalesce(json_agg(x),'[]') FROM public.support_customers x),
  'tickets',(SELECT coalesce(json_agg(x),'[]') FROM public.support_tickets x),
  'messages',(SELECT coalesce(json_agg(x),'[]') FROM public.support_messages x),
  'attachments',(SELECT coalesce(json_agg(x),'[]') FROM public.support_attachments x),
  'email_outbox',(SELECT coalesce(json_agg(x),'[]') FROM public.support_email_outbox x)
) AS support_export;
