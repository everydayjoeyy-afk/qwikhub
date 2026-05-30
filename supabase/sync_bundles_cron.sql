-- ============================================================
-- Daily automated bundle reconciliation
-- Schedules the sync-bundles edge function to run every day, so any
-- bundle the Cheap Bundles API stops offering is auto-deactivated
-- (and cost prices stay fresh). No manual "Sync Prices" click needed.
--
-- Prereqs: deploy the sync-bundles edge function first, and (optionally)
-- set a CRON_SECRET in the function's secrets, then put the same value
-- in REPLACE_WITH_CRON_SECRET below.
--
-- Run this once in the Supabase SQL Editor.
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Drop any previous schedule of the same name so this is re-runnable
select cron.unschedule('sync-bundles-daily')
where exists (select 1 from cron.job where jobname = 'sync-bundles-daily');

-- Daily at 02:00 UTC
select cron.schedule(
  'sync-bundles-daily',
  '0 2 * * *',
  $$
  select net.http_post(
    url     := 'https://uihiihiusqquzjprxuyw.supabase.co/functions/v1/sync-bundles',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'x-cron-secret', 'REPLACE_WITH_CRON_SECRET'
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- To verify the job is registered:
--   select jobname, schedule, active from cron.job where jobname = 'sync-bundles-daily';
-- To see recent runs:
--   select * from cron.job_run_details order by start_time desc limit 5;
