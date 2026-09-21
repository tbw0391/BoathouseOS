-- A lineup (boat + crew for a regatta day) can now carry its own race time
-- and label (e.g. "Event 4 - Women's Varsity 8+" at 9:15 AM), distinct from
-- the regatta's overall start time, so rowers/parents can be told exactly
-- when their boat races.

alter table lineups
  add column if not exists race_time timestamptz,
  add column if not exists race_name text;
