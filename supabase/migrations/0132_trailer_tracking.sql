-- Trailer tracking: admins name a Boat Trailer Driver and a Food Trailer
-- Driver (like Tent Leader). The day before a regatta, the driver turns on
-- tracking from their phone (/trailers) and everyone in the club can see
-- where the trailer is. When it's about 30 minutes out from the regatta,
-- everyone gets a phone alert to come help unload (sent by the app, see
-- app/trailers/actions.ts).
--
-- * Tracking can only be started the day before the regatta (Eastern), and
--   stops by itself once the regatta starts.
-- * One trip per trailer per regatta at a time. A second driver starting
--   the same trailer takes the trip over (swapping phones mid-drive).
-- * Members can't write trips directly; it all goes through the functions
--   below. Safe to re-run.

alter table profiles add column if not exists is_boat_trailer_driver boolean not null default false;
alter table profiles add column if not exists is_food_trailer_driver boolean not null default false;

-- Only admins can hand out the new positions (0109's guard, plus them).
create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
begin
  if auth.uid() is null or public.is_global_admin() then
    return new;
  end if;

  if new.club_id is distinct from old.club_id then
    raise exception 'Members can''t be moved to another club.';
  end if;

  select p.role::text into caller_role
  from profiles p
  where p.id = auth.uid() and p.approved_at is not null and p.disabled_at is null;

  if (new.role is distinct from old.role
      or new.approved_at is distinct from old.approved_at
      or new.is_board_member is distinct from old.is_board_member
      or new.is_tent_leader is distinct from old.is_tent_leader
      or new.is_treasurer is distinct from old.is_treasurer
      or new.is_apparel_chair is distinct from old.is_apparel_chair
      or new.is_boat_trailer_driver is distinct from old.is_boat_trailer_driver
      or new.is_food_trailer_driver is distinct from old.is_food_trailer_driver
      or new.club_title is distinct from old.club_title)
     and caller_role is distinct from 'admin' then
    raise exception 'Only admins can change role, approval, board member, tent leader, treasurer, apparel chair, trailer driver, or title.';
  end if;

  if new.disabled_at is distinct from old.disabled_at
     and coalesce(caller_role, '') not in ('admin', 'coach') then
    raise exception 'Only coaches and admins can remove or restore members.';
  end if;

  return new;
end;
$$;

create table if not exists public.trailer_trips (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null default public.default_club_id() references public.clubs (id),
  event_id uuid not null references public.schedule_events (id) on delete cascade,
  trailer text not null check (trailer in ('boat', 'food')),
  driver_id uuid references public.profiles (id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  -- Latest GPS fix from the driver's phone.
  lat double precision,
  lng double precision,
  accuracy_m double precision,
  speed_mps double precision,
  heading_deg double precision,
  located_at timestamptz,
  -- When the "about 30 minutes out" alert went to the club.
  arriving_alert_at timestamptz
);

create unique index if not exists trailer_trips_one_open_idx
  on public.trailer_trips (event_id, trailer) where ended_at is null;
create index if not exists trailer_trips_event_idx on public.trailer_trips (event_id);

alter table public.trailer_trips enable row level security;

drop policy if exists "members see trailer trips" on public.trailer_trips;
create policy "members see trailer trips"
  on public.trailer_trips for select
  to authenticated
  using (true);

revoke insert, update, delete, truncate on public.trailer_trips from anon, authenticated;

-- Is this regatta tomorrow, Eastern time?
create or replace function public.is_day_before_regatta(p_starts_at timestamptz)
returns boolean
language sql
stable
set search_path = public
as $$
  select (p_starts_at at time zone 'America/New_York')::date
       = (now() at time zone 'America/New_York')::date + 1;
$$;

-- The driver starts (or takes over) tracking a trailer to a regatta.
-- Returns the trip.
create or replace function public.start_trailer_trip(p_event uuid, p_trailer text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me profiles%rowtype;
  e schedule_events%rowtype;
  trip uuid;
begin
  select * into me from profiles
  where id = auth.uid() and approved_at is not null and disabled_at is null;
  if me.id is null then raise exception 'Only club members can track a trailer.'; end if;

  if p_trailer = 'boat' then
    if not me.is_boat_trailer_driver then
      raise exception 'Only the boat trailer driver can track the boat trailer. An admin can make you one on your profile.';
    end if;
  elsif p_trailer = 'food' then
    if not me.is_food_trailer_driver then
      raise exception 'Only the food trailer driver can track the food trailer. An admin can make you one on your profile.';
    end if;
  else
    raise exception 'Unknown trailer.';
  end if;

  select * into e from schedule_events where id = p_event and club_id = me.club_id;
  if e.id is null or e.event_type <> 'regatta' then raise exception 'That regatta is gone.'; end if;
  if not public.is_day_before_regatta(e.starts_at) then
    raise exception 'Trailer tracking only turns on the day before the regatta.';
  end if;
  if p_trailer = 'food' and not e.has_food_tent then
    raise exception 'This regatta has no food tent.';
  end if;

  -- One trailer at a time per driver.
  update trailer_trips set ended_at = now()
  where driver_id = me.id and ended_at is null and not (event_id = p_event and trailer = p_trailer);

  -- Already on the road (this phone reopened, or another driver's phone):
  -- carry on with the same trip so the club isn't alerted twice.
  select id into trip from trailer_trips
  where event_id = p_event and trailer = p_trailer and ended_at is null
  for update;
  if trip is not null then
    update trailer_trips set driver_id = me.id where id = trip;
    return trip;
  end if;

  insert into trailer_trips (club_id, event_id, trailer, driver_id)
  values (me.club_id, p_event, p_trailer, me.id)
  returning id into trip;
  return trip;
end;
$$;

-- A GPS fix from the driver's phone. Returns 'ok', 'ended' (stopped, or
-- the regatta has started) or 'taken_over' (another driver's phone has it).
create or replace function public.update_trailer_position(
  p_trip uuid,
  p_lat double precision,
  p_lng double precision,
  p_accuracy_m double precision,
  p_speed_mps double precision,
  p_heading_deg double precision
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  t trailer_trips%rowtype;
  starts timestamptz;
begin
  select * into t from trailer_trips where id = p_trip for update;
  if t.id is null or t.ended_at is not null then return 'ended'; end if;
  if t.driver_id is distinct from auth.uid() then return 'taken_over'; end if;

  select starts_at into starts from schedule_events where id = t.event_id;
  if starts is null or now() >= starts then
    update trailer_trips set ended_at = now() where id = p_trip;
    return 'ended';
  end if;

  if p_lat is null or p_lng is null or abs(p_lat) > 90 or abs(p_lng) > 180 then
    raise exception 'Bad GPS position.';
  end if;

  update trailer_trips
  set lat = p_lat,
      lng = p_lng,
      accuracy_m = case when p_accuracy_m >= 0 then p_accuracy_m end,
      speed_mps = case when p_speed_mps >= 0 then p_speed_mps end,
      heading_deg = case when p_heading_deg between 0 and 360 then p_heading_deg end,
      located_at = now()
  where id = p_trip;
  return 'ok';
end;
$$;

-- Stop tracking: the driver, or a coach/admin (a phone left on).
create or replace function public.end_trailer_trip(p_trip uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t trailer_trips%rowtype;
begin
  select * into t from trailer_trips
  where id = p_trip and club_id = (select club_id from profiles where id = auth.uid());
  if t.id is null then raise exception 'That trip is gone.'; end if;
  if t.driver_id is distinct from auth.uid() and not public.is_coach_or_admin() then
    raise exception 'Only the driver or a coach can stop tracking.';
  end if;
  update trailer_trips set ended_at = coalesce(ended_at, now()) where id = p_trip;
end;
$$;

revoke execute on function public.start_trailer_trip(uuid, text) from public, anon;
revoke execute on function public.update_trailer_position(uuid, double precision, double precision, double precision, double precision, double precision) from public, anon;
revoke execute on function public.end_trailer_trip(uuid) from public, anon;
grant execute on function public.start_trailer_trip(uuid, text) to authenticated;
grant execute on function public.update_trailer_position(uuid, double precision, double precision, double precision, double precision, double precision) to authenticated;
grant execute on function public.end_trailer_trip(uuid) to authenticated;

select public.apply_club_isolation();
select public.apply_approval_gate();
