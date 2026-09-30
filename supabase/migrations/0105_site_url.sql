-- The scheduled jobs (alerts every 5 minutes, the hourly Concept2 sync) and
-- the race-start trigger call this site's /api/cron endpoints. They used a
-- fixed https://www.boathouseos.app; now they go through cron_post(), which
-- uses the site_url secret in the Vault when there is one (production sets
-- it to its own address), else the demo's.
--
-- Production: select vault.create_secret('https://<its address>', 'site_url');
--
-- Safe to re-run.

create or replace function public.site_url()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select decrypted_secret from vault.decrypted_secrets where name = 'site_url'),
    'https://www.boathouseos.app'
  );
$$;

create or replace function public.cron_post(path text)
returns bigint
language sql
security definer
set search_path = ''
as $$
  select net.http_post(
    url := public.site_url() || path,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(
        (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'), ''
      )
    ),
    body := '{}'::jsonb
  );
$$;

revoke execute on function public.site_url() from public, anon, authenticated;
revoke execute on function public.cron_post(text) from public, anon, authenticated;

select cron.unschedule('scheduled-alerts') where exists (select 1 from cron.job where jobname = 'scheduled-alerts');
select cron.schedule('scheduled-alerts', '*/5 * * * *', $$select public.cron_post('/api/cron/alerts');$$);

select cron.unschedule('concept2-sync') where exists (select 1 from cron.job where jobname = 'concept2-sync');
select cron.schedule('concept2-sync', '17 * * * *', $$select public.cron_post('/api/cron/concept2');$$);

create or replace function public.track_race_progress()
returns trigger
language plpgsql
security definer
set search_path = public
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
        perform public.cron_post('/api/cron/alerts');
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
