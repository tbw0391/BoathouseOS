-- Travel tab on a regatta's page: departure and hotel details, rides (a bus
-- or someone's car, with seats people claim), and the rooming list. Coaches
-- and admins manage everything; any member can offer their own car, and
-- take or give up a seat for themselves or a rower they're a guardian of
-- (through the functions below). Safe to re-run.

create table if not exists regatta_travel (
  event_id uuid primary key references schedule_events (id) on delete cascade,
  depart_at timestamptz,
  depart_from text,
  return_at timestamptz,
  hotel_name text,
  hotel_address text,
  notes text,
  updated_at timestamptz not null default now()
);

create table if not exists travel_vehicles (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references schedule_events (id) on delete cascade,
  label text not null check (length(label) between 1 and 60),
  driver_id uuid references profiles (id) on delete set null,
  seats integer not null check (seats between 1 and 80),
  notes text,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists travel_riders (
  vehicle_id uuid not null references travel_vehicles (id) on delete cascade,
  event_id uuid not null references schedule_events (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  added_by uuid references profiles (id) on delete set null,
  primary key (vehicle_id, profile_id),
  unique (event_id, profile_id)
);

create table if not exists travel_rooms (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references schedule_events (id) on delete cascade,
  label text not null check (length(label) between 1 and 60),
  capacity integer not null default 4 check (capacity between 1 and 12),
  created_at timestamptz not null default now()
);

create table if not exists travel_room_members (
  room_id uuid not null references travel_rooms (id) on delete cascade,
  event_id uuid not null references schedule_events (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  primary key (room_id, profile_id),
  unique (event_id, profile_id)
);

alter table regatta_travel enable row level security;
alter table travel_vehicles enable row level security;
alter table travel_riders enable row level security;
alter table travel_rooms enable row level security;
alter table travel_room_members enable row level security;

do $$
declare t text;
begin
  foreach t in array array['regatta_travel', 'travel_vehicles', 'travel_riders', 'travel_rooms', 'travel_room_members']
  loop
    execute format('drop policy if exists "members see travel" on %I', t);
    execute format('create policy "members see travel" on %I for select to authenticated using (true)', t);
    execute format('drop policy if exists "coaches and admins manage travel" on %I', t);
    execute format(
      'create policy "coaches and admins manage travel" on %I for all to authenticated '
      || 'using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in (''coach'', ''admin''))) '
      || 'with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role in (''coach'', ''admin'')))',
      t
    );
  end loop;
end $$;

drop policy if exists "members offer and manage their own car" on travel_vehicles;
create policy "members offer and manage their own car"
  on travel_vehicles for all
  to authenticated
  using (driver_id = auth.uid())
  with check (driver_id = auth.uid());

-- Can the caller seat (or unseat) this person: themselves, a rower they're
-- a guardian of, or anyone if they're a coach or admin.
create or replace function public.can_act_for(person uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_approved() and (
    person = auth.uid()
    or exists (select 1 from family_links where guardian_id = auth.uid() and rower_id = person)
    or exists (select 1 from profiles where id = auth.uid() and role in ('coach', 'admin'))
  );
$$;

-- Take a seat (moving from any other ride for the same regatta).
create or replace function public.take_travel_seat(vehicle uuid, person uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ev uuid;
  cap integer;
  taken integer;
begin
  if not public.can_act_for(person) then
    raise exception 'You can only sign up yourself or your own rower.';
  end if;
  select event_id, seats into ev, cap from travel_vehicles where id = vehicle for update;
  if ev is null then raise exception 'That ride is gone.'; end if;
  select count(*) into taken from travel_riders where vehicle_id = vehicle and profile_id <> person;
  if taken >= cap then raise exception 'That ride is full.'; end if;
  delete from travel_riders where event_id = ev and profile_id = person;
  insert into travel_riders (vehicle_id, event_id, profile_id, added_by) values (vehicle, ev, person, auth.uid());
end;
$$;

create or replace function public.leave_travel_seat(vehicle uuid, person uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.can_act_for(person)
          or exists (select 1 from travel_vehicles where id = vehicle and driver_id = auth.uid())) then
    raise exception 'You can only change your own seat or your rower''s.';
  end if;
  delete from travel_riders where vehicle_id = vehicle and profile_id = person;
end;
$$;

revoke execute on function public.can_act_for(uuid) from public, anon;
revoke execute on function public.take_travel_seat(uuid, uuid) from public, anon;
revoke execute on function public.leave_travel_seat(uuid, uuid) from public, anon;
grant execute on function public.can_act_for(uuid) to authenticated;
grant execute on function public.take_travel_seat(uuid, uuid) to authenticated;
grant execute on function public.leave_travel_seat(uuid, uuid) to authenticated;

select public.apply_approval_gate();
