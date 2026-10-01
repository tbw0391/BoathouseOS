-- The USGS gauge a regatta's "Water at the course" card reads (Race Day),
-- picked by a coach or admin from the gauges near the course. Blank: the
-- app guesses (the biggest river near the course).
--
-- Safe to re-run.

alter table public.schedule_events add column if not exists water_gauge_site text
  check (water_gauge_site is null or water_gauge_site ~ '^[0-9]{8,15}$');
