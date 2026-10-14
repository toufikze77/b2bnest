-- Run BEFORE rollback.sql (service role / SQL editor). Read-only.
-- Returns one JSON document with every saved marketing record; save the result to a file.
SELECT json_build_object(
  'exported_at', now(),
  'audiences', (SELECT coalesce(json_agg(a ORDER BY created_at), '[]') FROM public.marketing_audiences a),
  'campaigns', (SELECT coalesce(json_agg(c ORDER BY created_at), '[]') FROM public.marketing_campaigns c),
  'content_items', (SELECT coalesce(json_agg(i ORDER BY created_at), '[]') FROM public.marketing_content_items i)
) AS marketing_export;
