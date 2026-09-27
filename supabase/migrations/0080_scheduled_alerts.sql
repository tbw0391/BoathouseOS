-- Scheduled push alerts: food list draft ready, bill due soon / overdue.
-- Every 5 minutes pg_cron calls /api/cron/alerts (pg_net), which works out
-- what's due and sends it. (Vercel's own cron only runs daily on the Hobby
-- plan.) Race-time alerts were left out on purpose: regattas run late.
--
-- Setup, once: pick a long random secret, add it to Vercel as CRON_SECRET,
-- and store the same value here:
--   select vault.create_secret('<the secret>', 'cron_secret');
-- Until both are set the calls are rejected and nothing is sent.

-- What's been sent, so each alert goes out once even if runs overlap.
create table scheduled_alerts_sent (
  kind text not null,
  ref text not null,
  sent_at timestamptz not null default now(),
  primary key (kind, ref)
);

-- Service role only: no policies, so members can't read or write it.
alter table scheduled_alerts_sent enable row level security;

-- Parents follow boats on the On the Water page to hear when they go out.
create table on_water_follows (
  profile_id uuid not null references profiles (id) on delete cascade,
  boat_id uuid not null references boats (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, boat_id)
);

alter table on_water_follows enable row level security;

create policy "members manage the boats they follow"
  on on_water_follows for all
  to authenticated
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

select public.apply_approval_gate();

create extension if not exists pg_net;

select cron.schedule(
  'scheduled-alerts',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://www.boathouseos.app/api/cron/alerts',
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
