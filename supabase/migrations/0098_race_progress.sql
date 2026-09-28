-- Racing banner: a regatta race (its lineup) is marked racing when the boat,
-- tracked on On the Water, crosses the start and finished when it reaches
-- the finish, worked out from each GPS ping against the regatta's course
-- (0082; borrowed from the latest regatta at the same place when it has
-- none). A ping counts toward that boat's race closest in time, from 45
-- minutes before its race time to 2 hours after, so warm-ups earlier and a
-- boat racing twice in a day both work. Crossing the start also calls
-- /api/cron/alerts straight away so followers hear within seconds (the
-- 5-minute cron picks it up otherwise). Safe to re-run.

alter table lineups add column if not exists race_started_at timestamptz;
alter table lineups add column if not exists race_finished_at timestamptz;

-- How far along the straight start->finish line a point is: 0 at the start,
-- 1 at the finish, negative before the start.
create or replace function public.course_progress(
  p_lat double precision, p_lng double precision,
  s_lat double precision, s_lng double precision,
  f_lat double precision, f_lng double precision
) returns double precision
language sql
immutable
as $$
  select case when dd = 0 then null else ((p_lng - s_lng) * k * dx + (p_lat - s_lat) * dy) / dd end
  from (
    select cos(radians(s_lat)) as k,
           (f_lng - s_lng) * cos(radians(s_lat)) as dx,
           (f_lat - s_lat) as dy,
           power((f_lng - s_lng) * cos(radians(s_lat)), 2) + power(f_lat - s_lat, 2) as dd
  ) g;
$$;

-- Rough metres between two nearby points.
create or replace function public.near_distance_m(
  a_lat double precision, a_lng double precision,
  b_lat double precision, b_lng double precision
) returns double precision
language sql
immutable
as $$
  select 111320 * sqrt(power((a_lng - b_lng) * cos(radians(a_lat)), 2) + power(a_lat - b_lat, 2));
$$;

create or replace function public.track_race_progress()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  sess record;
  race record;
  crs record;
  prev record;
  t_new double precision;
  t_prev double precision;
begin
  select id, boat_id into sess from on_water_sessions where id = new.session_id;
  if sess.boat_id is null then
    return new;
  end if;

  -- This boat's race nearest this ping, still to finish.
  select l.id as lineup_id, l.race_time, l.race_started_at,
         e.id as event_id, e.location, e.start_lat, e.start_lng, e.finish_lat, e.finish_lng
    into race
  from lineups l join schedule_events e on e.id = l.event_id
  where l.boat_id = sess.boat_id
    and e.event_type = 'regatta'
    and l.race_finished_at is null
    and l.race_time between new.recorded_at - interval '2 hours' and new.recorded_at + interval '45 minutes'
  order by abs(extract(epoch from l.race_time - new.recorded_at))
  limit 1;
  if not found then
    return new;
  end if;

  if race.start_lat is not null and race.finish_lat is not null then
    select race.start_lat as start_lat, race.start_lng as start_lng,
           race.finish_lat as finish_lat, race.finish_lng as finish_lng into crs;
  else
    select start_lat, start_lng, finish_lat, finish_lng into crs
    from schedule_events
    where location = race.location and id <> race.event_id
      and start_lat is not null and finish_lat is not null
    order by starts_at desc limit 1;
    if not found then
      return new;
    end if;
  end if;

  t_new := public.course_progress(new.lat, new.lng, crs.start_lat, crs.start_lng, crs.finish_lat, crs.finish_lng);
  if t_new is null then
    return new;
  end if;

  if race.race_started_at is null then
    -- Started: this ping is past the start line, the one before wasn't, and
    -- it happened at the start (not somewhere else on a bendy course).
    select lat, lng into prev
    from location_pings
    where session_id = new.session_id
      and recorded_at < new.recorded_at
      and recorded_at >= race.race_time - interval '45 minutes'
    order by recorded_at desc limit 1;
    if not found then
      return new;
    end if;
    t_prev := public.course_progress(prev.lat, prev.lng, crs.start_lat, crs.start_lng, crs.finish_lat, crs.finish_lng);
    if t_prev < 0 and t_new >= 0
       and public.near_distance_m(new.lat, new.lng, crs.start_lat, crs.start_lng) < 250 then
      update lineups set race_started_at = new.recorded_at where id = race.lineup_id;
      begin
        perform net.http_post(
          url := 'https://www.boathouseos.app/api/cron/alerts',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || coalesce(
              (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'), ''
            )
          ),
          body := '{}'::jsonb
        );
      exception when others then
        null; -- the 5-minute cron sends it instead
      end;
    end if;
  elsif public.near_distance_m(new.lat, new.lng, crs.finish_lat, crs.finish_lng) < 100
     or (t_new >= 1 and public.near_distance_m(new.lat, new.lng, crs.finish_lat, crs.finish_lng) < 500) then
    update lineups set race_finished_at = new.recorded_at where id = race.lineup_id;
  end if;

  return new;
end;
$$;

revoke execute on function public.track_race_progress() from public, anon, authenticated;

drop trigger if exists track_race_progress on location_pings;
create trigger track_race_progress
  after insert on location_pings
  for each row execute function public.track_race_progress();
