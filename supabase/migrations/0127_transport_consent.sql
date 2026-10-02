-- SafeSport transportation (MAAPP 2025, Transportation): a parent's written
-- consent, renewed every year, for
--   * club_travel: any club-arranged travel (every ride on a regatta's
--     Travel tab counts), and
--   * one_on_one: riding alone with an adult who isn't their parent (no
--     other adult, and fewer than two minors in the car).
-- Parents (or an admin recording a paper form) give or withdraw it on the
-- rower's profile; it lasts a year. take_travel_seat checks it for rowers
-- and coxes under 18 (same rule as messaging, 0123), unless the driver is
-- their own parent. Safe to re-run. Needs 0123 (safesport_minor/_needs_copy).

create table if not exists public.transport_consents (
  rower_id uuid primary key references public.profiles (id) on delete cascade,
  club_id uuid not null default public.default_club_id() references public.clubs (id),
  club_travel boolean not null default false,
  one_on_one boolean not null default false,
  given_by uuid references public.profiles (id) on delete set null,
  given_by_name text not null default '',
  given_at timestamptz not null default now(),
  expires_on date not null default (current_date + interval '1 year')::date
);

alter table public.transport_consents enable row level security;

drop policy if exists "family, coaches and admins see travel consent" on public.transport_consents;
create policy "family, coaches and admins see travel consent"
  on public.transport_consents for select
  to authenticated
  using ((select public.can_act_for(rower_id)));

-- Only the rower's parent/guardian, or an admin (a paper form), never the
-- rower or a coach.
drop policy if exists "parents and admins give travel consent" on public.transport_consents;
create policy "parents and admins give travel consent"
  on public.transport_consents for all
  to authenticated
  using (
    exists (select 1 from family_links where guardian_id = auth.uid() and rower_id = transport_consents.rower_id)
    or (select public.is_club_admin())
  )
  with check (
    given_by = auth.uid()
    and (
      exists (select 1 from family_links where guardian_id = auth.uid() and rower_id = transport_consents.rower_id)
      or (select public.is_club_admin())
    )
  );

-- Who's riding, and does anyone need (and lack) consent? Returns null when
-- the ride is fine for this minor, otherwise why not.
create or replace function public.travel_consent_problem(vehicle uuid, person uuid, adding boolean)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  driver uuid;
  pname text;
  c transport_consents%rowtype;
  minors integer;
  adults integer;
begin
  if not public.safesport_minor(person) then
    return null;
  end if;
  select driver_id into driver from travel_vehicles where id = vehicle;
  -- A parent driving their own child: nothing to consent to.
  if driver is not null and exists (select 1 from family_links where guardian_id = driver and rower_id = person) then
    return null;
  end if;

  select display_name into pname from profiles where id = person;
  select * into c from transport_consents where rower_id = person and expires_on >= current_date;

  if not coalesce(c.club_travel, false) then
    return 'SafeSport: ' || pname || ' needs a parent''s yearly travel consent before taking a seat. A parent can give it on ' || pname || '''s profile.';
  end if;

  if driver is not null and public.safesport_needs_copy(driver, person) then
    -- Everyone else in the car (with this person in it).
    select
      count(*) filter (where public.safesport_minor(r.profile_id)),
      count(*) filter (where not public.safesport_minor(r.profile_id))
    into minors, adults
    from (
      select profile_id from travel_riders where vehicle_id = vehicle and profile_id <> person
      union all
      select person where adding
    ) r(profile_id);
    if adults = 0 and minors < 2 and not coalesce(c.one_on_one, false) then
      return 'SafeSport: ' || pname || ' would ride alone with the driver, which needs a parent''s yearly one-on-one ride consent (on ' || pname || '''s profile), or another adult or rower in the car.';
    end if;
  end if;
  return null;
end;
$$;

revoke execute on function public.travel_consent_problem(uuid, uuid, boolean) from public, anon;
grant execute on function public.travel_consent_problem(uuid, uuid, boolean) to authenticated;

-- Same as 0086, plus the consent check.
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
  problem text;
begin
  if not public.can_act_for(person) then
    raise exception 'You can only sign up yourself or your own rower.';
  end if;
  select event_id, seats into ev, cap from travel_vehicles where id = vehicle for update;
  if ev is null then raise exception 'That ride is gone.'; end if;
  select count(*) into taken from travel_riders where vehicle_id = vehicle and profile_id <> person;
  if taken >= cap then raise exception 'That ride is full.'; end if;
  problem := public.travel_consent_problem(vehicle, person, true);
  if problem is not null then raise exception '%', problem; end if;
  delete from travel_riders where event_id = ev and profile_id = person;
  insert into travel_riders (vehicle_id, event_id, profile_id, added_by) values (vehicle, ev, person, auth.uid());
end;
$$;

select public.apply_club_isolation();
select public.apply_approval_gate();
