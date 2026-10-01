-- The coach's practice call (0087) also records the conditions they saw:
-- air temperature, wind speed and wind direction, next to the water
-- temperature it already had.
--
-- Safe to re-run.

alter table public.practice_calls
  add column if not exists air_temp_f numeric(4, 1),
  add column if not exists wind_mph numeric(4, 1),
  add column if not exists wind_dir text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'practice_calls_wind_dir_check') then
    alter table public.practice_calls add constraint practice_calls_wind_dir_check
      check (wind_dir is null or wind_dir in ('N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'));
  end if;
end;
$$;
