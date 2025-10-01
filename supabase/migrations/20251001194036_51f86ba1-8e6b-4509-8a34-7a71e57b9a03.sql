-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create cron job to fetch news every 5 minutes
SELECT cron.schedule(
  'fetch-business-news-every-5-min',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT
    net.http_post(
        url:='https://gvftvswyrevummbvyhxa.supabase.co/functions/v1/fetch-news',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2ZnR2c3d5cmV2dW1tYnZ5aHhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4OTU4NTUsImV4cCI6MjA2NjQ3MTg1NX0.Fxj47eYV6jz0SjyNSd4770ApYSY0_1MQZsZRrFZQ6cA"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);