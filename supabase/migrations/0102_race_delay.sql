-- Race day running late: a coach sets how far behind the regatta is running
-- (on the Race Day page), which pushes back every race and launch time shown
-- and the launch reminder. A coach can also send a crew a "racing in about
-- 20 minutes" alert by hand; race_soon_sent_at records that it went.
-- Safe to re-run.

alter table schedule_events add column if not exists race_delay_minutes integer not null default 0;
alter table schedule_events drop constraint if exists schedule_events_race_delay_minutes_check;
alter table schedule_events
  add constraint schedule_events_race_delay_minutes_check check (race_delay_minutes between 0 and 240);

alter table lineups add column if not exists race_soon_sent_at timestamptz;
