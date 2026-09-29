-- Concept2 automatic sync: a rower (or their parent or coach) connects the
-- rower's Concept2 Logbook account once, and new RowErg pieces show up on
-- Workouts by themselves (lib/concept2.ts). Tokens live here and only the
-- service role can read or write it (RLS on, no policies); the Workouts
-- page asks the server whether a rower is connected. An hourly pg_cron job
-- calls /api/cron/concept2 with the same cron_secret as the alerts job
-- (0080). Nothing happens until CONCEPT2_CLIENT_ID and
-- CONCEPT2_CLIENT_SECRET are set in Vercel. Safe to re-run.

create table if not exists concept2_links (
  profile_id uuid primary key references profiles (id) on delete cascade,
  c2_user_id bigint not null,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  connected_by uuid references profiles (id) on delete set null,
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz,
  -- Set when Concept2 stops accepting the connection (the rower revoked
  -- it, or the refresh token expired after a year); the page asks them
  -- to reconnect.
  last_error text
);

alter table concept2_links enable row level security;

-- Kept out of the demo baseline like the other service-only tables.
create or replace function demo_baseline.excluded_tables()
returns text[]
language sql
immutable
set search_path to ''
as $$
  select array['global_admins', 'interest_signups', 'error_reports', 'concept2_links']::text[];
$$;

select public.apply_approval_gate();

select cron.unschedule('concept2-sync')
where exists (select 1 from cron.job where jobname = 'concept2-sync');

select cron.schedule(
  'concept2-sync',
  '17 * * * *',
  $$
  select net.http_post(
    url := 'https://www.boathouseos.app/api/cron/concept2',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(
        (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'), ''
      )
    ),
    body := '{}'::jsonb
  );
  $$
);
