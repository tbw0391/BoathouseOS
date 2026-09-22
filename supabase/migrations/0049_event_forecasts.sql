-- Cached weather forecast for a regatta's location/date, so the home page
-- banner doesn't call the National Weather Service (and the geocoder) on
-- every single page view — it's refreshed opportunistically whenever
-- someone opens the app and the cached row is missing or stale.
create table event_forecasts (
  event_id uuid primary key references schedule_events (id) on delete cascade,
  geocoded_location text,
  latitude double precision,
  longitude double precision,
  forecast_date date,
  high_f int,
  low_f int,
  short_forecast text,
  precipitation_chance int,
  wind text,
  icon_url text,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table event_forecasts enable row level security;

create policy "event forecasts are readable by authenticated users"
  on event_forecasts for select
  to authenticated
  using (true);

-- Not sensitive, system-computed data (public weather for a public event
-- location) — any signed-in user's page load can refresh the cache, same
-- as any of them can trigger the fetch that populates it.
create policy "authenticated users can refresh event forecasts"
  on event_forecasts for all
  to authenticated
  using (true)
  with check (true);
