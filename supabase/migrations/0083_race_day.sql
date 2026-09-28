-- Race Day page: each lineup's bow number (what's on the bow ball / the
-- regatta's heat sheet; text since some regattas use letters). Launch time
-- is worked out from the race time and the club's "launch minutes before"
-- setting (club_settings race_day_launch_minutes). Safe to re-run.

alter table lineups add column if not exists bow_number text;
