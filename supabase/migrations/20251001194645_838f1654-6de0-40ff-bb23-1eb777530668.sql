-- Trigger immediate news fetch
SELECT net.http_post(
  url:='https://gvftvswyrevummbvyhxa.supabase.co/functions/v1/fetch-news',
  headers:='{"Content-Type": "application/json"}'::jsonb,
  body:='{}'::jsonb
) as request_id;