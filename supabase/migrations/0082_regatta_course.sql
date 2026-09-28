-- Where a regatta's race starts and finishes, set by tapping a map on the
-- regatta's Course tab (coaches and admins, via the existing "coaches and
-- admins manage events" policy). Groundwork for telling when a tracked boat
-- is racing. Safe to re-run.

alter table schedule_events
  add column if not exists start_lat double precision,
  add column if not exists start_lng double precision,
  add column if not exists finish_lat double precision,
  add column if not exists finish_lng double precision;
