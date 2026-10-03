-- Course markers (Todd, 2026-10-03): pins along a regatta's course (e.g.
-- 500 / 1000 / 1500 m) besides the start and finish (0082). While a boat is
-- racing (0098: its tracked phone crossed the start), each GPS ping is
-- checked against every marker; when the boat passes one, the time is saved
-- in lineup_course_splits, worked out between the two pings either side of
-- it (pings are ~7 s apart). Race Day and the home banner show "passed
-- 1000 m at 9:42:15" and the splits; the alerts job can tell parents.
--
-- * schedule_events.course_markers: [{ "m": 500, "lat": .., "lng": .. }, ...]
--   in course order. A regatta with no course of its own borrows the start,
--   finish and markers of the latest one at the same place.
-- * A marker counts as passed when the boat goes from behind it to past it,
--   measured along the course's direction at that marker (the line from the
--   pin before it to the pin after it, so bends are fine), and the boat is
--   within 200 m of it.
-- * The start and finish times are also worked out between pings now (they
--   used to be the first ping past the start and the first ping within
--   100 m of the finish, which could be several seconds early), so splits
--   and total time are fairer.
-- GPS is good to a few metres: for following along, not official times.
-- Safe to re-run.

alter table public.schedule_events
  add column if not exists course_markers jsonb not null default '[]'::jsonb;

create table if not exists public.lineup_course_splits (
  lineup_id uuid not null references public.lineups (id) on delete cascade,
  club_id uuid not null default public.default_club_id() references public.clubs (id),
  meters integer not null check (meters > 0),
  passed_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (lineup_id, meters)
);

create index if not exists lineup_course_splits_club_id_idx on public.lineup_course_splits (club_id);
create index if not exists lineup_course_splits_created_at_idx on public.lineup_course_splits (created_at desc);

alter table public.lineup_course_splits enable row level security;

-- Everyone in the club can follow along. Only the trigger below writes.
drop policy if exists "members see course splits" on public.lineup_course_splits;
create policy "members see course splits"
  on public.lineup_course_splits for select
  to authenticated
  using (true);

-- Signed distance (metres) of point p past marker m, measured along the
-- direction from point a (pin before the marker) to point b (pin after it).
-- Negative = not there yet.
create or replace function public.past_marker_m(
  p_lat double precision, p_lng double precision,
  m_lat double precision, m_lng double precision,
  a_lat double precision, a_lng double precision,
  b_lat double precision, b_lng double precision
) returns double precision
language sql
immutable
as $$
  select case when len = 0 then null
    else 111320 * ((p_lng - m_lng) * k * dx + (p_lat - m_lat) * dy) / len end
  from (
    select cos(radians(m_lat)) as k,
           (b_lng - a_lng) * cos(radians(m_lat)) as dx,
           (b_lat - a_lat) as dy,
           sqrt(power((b_lng - a_lng) * cos(radians(m_lat)), 2) + power(b_lat - a_lat, 2)) as len
  ) g;
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
  started boolean := false;
  markers jsonb;
  n integer;
  i integer;
  mk jsonb;
  m_lat double precision;
  m_lng double precision;
  a_lat double precision;
  a_lng double precision;
  b_lat double precision;
  b_lng double precision;
  s_prev double precision;
  s_new double precision;
  added integer;
  any_added boolean := false;
begin
  select id, boat_id into sess from on_water_sessions where id = new.session_id;
  if sess.boat_id is null then
    return new;
  end if;

  -- This boat's race nearest this ping, still to finish.
  select l.id as lineup_id, l.club_id, l.race_time, l.race_started_at,
         e.id as event_id, e.location, e.start_lat, e.start_lng, e.finish_lat, e.finish_lng,
         e.course_markers
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
           race.finish_lat as finish_lat, race.finish_lng as finish_lng,
           race.course_markers as course_markers into crs;
  else
    select start_lat, start_lng, finish_lat, finish_lng, course_markers into crs
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

  -- The ping before this one (since warm-up began).
  select lat, lng, recorded_at into prev
  from location_pings
  where session_id = new.session_id
    and recorded_at < new.recorded_at
    and recorded_at >= race.race_time - interval '45 minutes'
  order by recorded_at desc limit 1;
  if not found then
    return new;
  end if;

  if race.race_started_at is null then
    -- Started: this ping is past the start line, the one before wasn't, and
    -- it happened at the start (not somewhere else on a bendy course). The
    -- time is worked out between the two pings.
    t_prev := public.course_progress(prev.lat, prev.lng, crs.start_lat, crs.start_lng, crs.finish_lat, crs.finish_lng);
    if t_prev < 0 and t_new >= 0
       and public.near_distance_m(new.lat, new.lng, crs.start_lat, crs.start_lng) < 250 then
      update lineups
        set race_started_at = prev.recorded_at
          + (new.recorded_at - prev.recorded_at) * (-t_prev / nullif(t_new - t_prev, 0))
        where id = race.lineup_id;
      started := true;
      begin
        perform public.cron_post('/api/cron/alerts');
      exception when others then
        null; -- the 5-minute cron sends it instead
      end;
    else
      return new;
    end if;
  end if;

  -- Markers passed between the last ping and this one.
  markers := coalesce(crs.course_markers, '[]'::jsonb);
  n := case when jsonb_typeof(markers) = 'array' then jsonb_array_length(markers) else 0 end;
  for i in 0 .. n - 1 loop
    mk := markers -> i;
    m_lat := (mk ->> 'lat')::double precision;
    m_lng := (mk ->> 'lng')::double precision;
    continue when m_lat is null or m_lng is null or coalesce((mk ->> 'm')::integer, 0) <= 0;
    if i = 0 then
      a_lat := crs.start_lat; a_lng := crs.start_lng;
    else
      a_lat := (markers -> (i - 1) ->> 'lat')::double precision;
      a_lng := (markers -> (i - 1) ->> 'lng')::double precision;
    end if;
    if i = n - 1 then
      b_lat := crs.finish_lat; b_lng := crs.finish_lng;
    else
      b_lat := (markers -> (i + 1) ->> 'lat')::double precision;
      b_lng := (markers -> (i + 1) ->> 'lng')::double precision;
    end if;
    s_prev := public.past_marker_m(prev.lat, prev.lng, m_lat, m_lng, a_lat, a_lng, b_lat, b_lng);
    s_new := public.past_marker_m(new.lat, new.lng, m_lat, m_lng, a_lat, a_lng, b_lat, b_lng);
    if s_prev < 0 and s_new >= 0
       and public.near_distance_m(new.lat, new.lng, m_lat, m_lng) < 200 then
      insert into lineup_course_splits (lineup_id, club_id, meters, passed_at)
      values (
        race.lineup_id, race.club_id, (mk ->> 'm')::integer,
        prev.recorded_at + (new.recorded_at - prev.recorded_at) * (-s_prev / nullif(s_new - s_prev, 0))
      )
      on conflict (lineup_id, meters) do nothing;
      get diagnostics added = row_count;
      any_added := any_added or added > 0;
    end if;
  end loop;
  if any_added and not started then
    begin
      perform public.cron_post('/api/cron/alerts');
    exception when others then
      null;
    end;
  end if;

  -- Finished: crossed the finish line (measured along the last stretch of
  -- the course, from the last marker or the start), with the time worked
  -- out between pings; or just past it after a gap in the pings.
  a_lat := crs.start_lat; a_lng := crs.start_lng;
  if n > 0 and (markers -> (n - 1) ->> 'lat') is not null then
    a_lat := (markers -> (n - 1) ->> 'lat')::double precision;
    a_lng := (markers -> (n - 1) ->> 'lng')::double precision;
  end if;
  s_prev := public.past_marker_m(prev.lat, prev.lng, crs.finish_lat, crs.finish_lng, a_lat, a_lng, crs.finish_lat, crs.finish_lng);
  s_new := public.past_marker_m(new.lat, new.lng, crs.finish_lat, crs.finish_lng, a_lat, a_lng, crs.finish_lat, crs.finish_lng);
  if s_prev < 0 and s_new >= 0
     and public.near_distance_m(new.lat, new.lng, crs.finish_lat, crs.finish_lng) < 250 then
    update lineups
      set race_finished_at = prev.recorded_at
        + (new.recorded_at - prev.recorded_at) * (-s_prev / nullif(s_new - s_prev, 0))
      where id = race.lineup_id;
  elsif s_new >= 0 and s_new < 150
     and public.near_distance_m(new.lat, new.lng, crs.finish_lat, crs.finish_lng) < 300 then
    -- Already just past the line without the ping before being behind it
    -- (a gap in the pings): finished at this ping.
    update lineups set race_finished_at = new.recorded_at where id = race.lineup_id;
  end if;

  return new;
end;
$$;

revoke execute on function public.track_race_progress() from public, anon, authenticated;

select public.apply_club_isolation();
select public.apply_approval_gate();
