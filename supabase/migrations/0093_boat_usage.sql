-- Boat usage from On the Water tracks: each outing's distance is worked
-- out from its GPS pings when it ends (skipping fixes worse than 50 m and
-- jumps faster than 8 m/s, which no rowing shell does), and boats get a
-- service interval so the Boats page can say when one's due. Safe to re-run.

alter table on_water_sessions add column if not exists meters integer;
alter table boats add column if not exists service_every_km integer check (service_every_km is null or service_every_km > 0);
alter table boats add column if not exists last_service_at timestamptz;

create or replace function public.session_meters(sid uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  with p as (
    select lat, lng, recorded_at,
      lag(lat) over w as plat,
      lag(lng) over w as plng,
      lag(recorded_at) over w as pt
    from location_pings
    where session_id = sid and (accuracy_m is null or accuracy_m <= 50)
    window w as (order by recorded_at)
  ), d as (
    select
      2 * 6371000 * asin(sqrt(
        power(sin(radians(lat - plat) / 2), 2)
        + cos(radians(plat)) * cos(radians(lat)) * power(sin(radians(lng - plng) / 2), 2)
      )) as m,
      extract(epoch from recorded_at - pt) as s
    from p
    where plat is not null
  )
  select coalesce(round(sum(m))::integer, 0) from d where s > 0 and m / s <= 8;
$$;

-- Only the trigger below uses it.
revoke execute on function public.session_meters(uuid) from public, anon, authenticated;

create or replace function public.set_session_meters()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.ended_at is not null and old.ended_at is null then
    new.meters := public.session_meters(new.id);
  end if;
  return new;
end;
$$;

revoke execute on function public.set_session_meters() from public, anon, authenticated;

drop trigger if exists on_water_sessions_meters on on_water_sessions;
create trigger on_water_sessions_meters
  before update of ended_at on on_water_sessions
  for each row execute function public.set_session_meters();

-- Outings that already ended.
update on_water_sessions set meters = public.session_meters(id) where ended_at is not null and meters is null;
