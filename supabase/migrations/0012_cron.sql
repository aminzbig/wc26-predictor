-- Run the `tick` Edge Function every minute via pg_cron. This replaces the
-- GitHub Actions "Live scores" cron, which GitHub throttled to ~once every 6h
-- (so live scores, instant FT scoring and pre-kickoff lineups never landed in
-- time). pg_cron fires reliably from inside the database.
--
-- PREREQUISITE (run once, NOT committed — keeps the secret out of git):
--   select vault.create_secret('<same value as the CRON_SECRET function secret>', 'cron_secret');
-- and deploy the function:  supabase functions deploy tick --no-verify-jwt
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Remove any prior schedule with this name so re-applying is safe.
do $$
declare j int;
begin
  for j in select jobid from cron.job where jobname = 'tick-live' loop
    perform cron.unschedule(j);
  end loop;
end $$;

select cron.schedule(
  'tick-live',
  '* * * * *',
  $cron$
  select net.http_post(
    url := 'https://ekgaegdtozqeziyycoul.supabase.co/functions/v1/tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
  $cron$
);
