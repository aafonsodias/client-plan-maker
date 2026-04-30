
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-trainer-digest') THEN
    PERFORM cron.unschedule('weekly-trainer-digest');
  END IF;
END $$;

SELECT cron.schedule(
  'weekly-trainer-digest',
  '0 8 * * 1', -- every Monday 08:00 UTC
  $$
  SELECT net.http_post(
    url := 'https://project--52660b57-3b15-46ae-b3c1-32e2157652c6.lovable.app/api/public/hooks/weekly-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer forge_digest_5f3c8a7b9e1d4f2a6c8b3d7e9a1f4c2b'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
