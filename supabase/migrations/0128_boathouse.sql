-- Boathouse: rower ratings, boat and erg reservations, and the boat sign-out
-- logbook (2026-10-02, what masters clubs use iCrew Premium for).
--
-- * Ratings: each member gets a level (0 not rated, 1-3) from a coach or
--   admin; each boat gets a minimum level, whether members can book and
--   take it out themselves, and an out-of-service switch.
-- * Swim test: when the club's Paperwork settings require one for the
--   member's role, it has to be on file and current to book or take a boat.
-- * Reservations: a boat or erg for a time slot (up to 6 hours), never
--   overlapping. Members book bookable boats/ergs for themselves and who
--   they row with; coaches and admins book anything (e.g. for practice).
-- * Logbook: sign a boat out (crew, route, expected back) and back in
--   (distance, anything broken goes to Boat Maintenance). One sign-out at a
--   time per boat; the overdue check alerts the crew and coaches.
-- Booking, signing out and in go through the functions below, which check
-- all of this; members can't write the tables directly. Safe to re-run.

create table if not exists public.member_ratings (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  club_id uuid not null default public.default_club_id() references public.clubs (id),
  rating smallint not null default 0 check (rating between 0 and 3),
  rated_by uuid references public.profiles (id) on delete set null,
  rated_at timestamptz not null default now()
);

alter table public.member_ratings enable row level security;

drop policy if exists "members see ratings" on public.member_ratings;
create policy "members see ratings"
  on public.member_ratings for select
  to authenticated
  using (true);

drop policy if exists "coaches and admins set ratings" on public.member_ratings;
create policy "coaches and admins set ratings"
  on public.member_ratings for all
  to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')));

alter table public.boats add column if not exists bookable boolean not null default false;
alter table public.boats add column if not exists min_rating smallint not null default 0 check (min_rating between 0 and 3);
alter table public.boats add column if not exists out_of_service boolean not null default false;

create table if not exists public.ergs (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null default public.default_club_id() references public.clubs (id),
  name text not null check (length(name) between 1 and 40),
  bookable boolean not null default true,
  out_of_service boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.ergs enable row level security;

drop policy if exists "members see ergs" on public.ergs;
create policy "members see ergs"
  on public.ergs for select
  to authenticated
  using (true);

drop policy if exists "coaches and admins manage ergs" on public.ergs;
create policy "coaches and admins manage ergs"
  on public.ergs for all
  to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')));

create table if not exists public.boat_reservations (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null default public.default_club_id() references public.clubs (id),
  boat_id uuid references public.boats (id) on delete cascade,
  erg_id uuid references public.ergs (id) on delete cascade,
  booked_by uuid references public.profiles (id) on delete set null,
  rower_ids uuid[] not null default '{}',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  note text,
  created_at timestamptz not null default now(),
  check ((boat_id is null) <> (erg_id is null)),
  check (ends_at > starts_at and ends_at - starts_at <= interval '6 hours')
);

create index if not exists boat_reservations_boat_idx on public.boat_reservations (boat_id, starts_at);
create index if not exists boat_reservations_erg_idx on public.boat_reservations (erg_id, starts_at);
create index if not exists boat_reservations_club_idx on public.boat_reservations (club_id, starts_at);

alter table public.boat_reservations enable row level security;

drop policy if exists "members see reservations" on public.boat_reservations;
create policy "members see reservations"
  on public.boat_reservations for select
  to authenticated
  using (true);

revoke insert, update, truncate on public.boat_reservations from anon, authenticated;

-- Cancel your own, or any as a coach or admin.
drop policy if exists "cancel own reservations" on public.boat_reservations;
create policy "cancel own reservations"
  on public.boat_reservations for delete
  to authenticated
  using (
    booked_by = auth.uid()
    or auth.uid() = any (rower_ids)
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin'))
  );

create table if not exists public.boat_signouts (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null default public.default_club_id() references public.clubs (id),
  boat_id uuid not null references public.boats (id) on delete cascade,
  rower_ids uuid[] not null default '{}',
  signed_out_by uuid references public.profiles (id) on delete set null,
  out_at timestamptz not null default now(),
  expected_back_at timestamptz not null,
  route text,
  back_at timestamptz,
  signed_in_by uuid references public.profiles (id) on delete set null,
  meters integer check (meters is null or meters between 0 and 100000),
  damage text,
  overdue_alerted_at timestamptz,
  check (expected_back_at > out_at)
);

create unique index if not exists boat_signouts_one_out on public.boat_signouts (boat_id) where back_at is null;
create index if not exists boat_signouts_club_idx on public.boat_signouts (club_id, out_at desc);

alter table public.boat_signouts enable row level security;

drop policy if exists "members see the logbook" on public.boat_signouts;
create policy "members see the logbook"
  on public.boat_signouts for select
  to authenticated
  using (true);

drop policy if exists "coaches and admins fix the logbook" on public.boat_signouts;
create policy "coaches and admins fix the logbook"
  on public.boat_signouts for delete
  to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')));

revoke insert, update, truncate on public.boat_signouts from anon, authenticated;

create or replace function public.is_coach_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('coach', 'admin') and approved_at is not null and disabled_at is null
  );
$$;

revoke execute on function public.is_coach_or_admin() from public, anon;
grant execute on function public.is_coach_or_admin() to authenticated;

-- Why this person can't take this boat out (rating, swim test), or null.
create or replace function public.boat_rower_problem(boat uuid, person uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  p profiles%rowtype;
  need smallint;
  have smallint;
  swim_roles text[];
begin
  select * into p from profiles where id = person;
  if p.id is null or p.disabled_at is not null or p.approved_at is null then
    return 'Someone in the crew isn''t an active member.';
  end if;

  select min_rating into need from boats where id = boat;
  select rating into have from member_ratings where profile_id = person;
  if coalesce(have, 0) < coalesce(need, 0) then
    return p.display_name || ' needs a level ' || need || ' rating for this boat (a coach sets ratings).';
  end if;

  -- Who needs a swim test is set per club (Admin Settings → Paperwork);
  -- rowers and coxswains when the club hasn't chosen.
  swim_roles := array['rower', 'coxswain'];
  select array(select jsonb_array_elements_text(s.value::jsonb -> 'required' -> 'swim_test'))
    into swim_roles
  from club_settings s
  where s.club_id = p.club_id and s.key = 'paperwork_settings'
    and jsonb_typeof(s.value::jsonb -> 'required' -> 'swim_test') = 'array';
  swim_roles := coalesce(swim_roles, array['rower', 'coxswain']);
  if p.role::text = any (swim_roles) and not exists (
    select 1 from member_paperwork w
    where w.profile_id = person and w.kind = 'swim_test' and w.completed_on is not null
      and (w.expires_on is null or w.expires_on >= current_date)
  ) then
    return p.display_name || '''s swim test isn''t on file (Paperwork on their profile).';
  end if;
  return null;
end;
$$;

revoke execute on function public.boat_rower_problem(uuid, uuid) from public, anon;
grant execute on function public.boat_rower_problem(uuid, uuid) to authenticated;

-- Book a boat or erg. Returns the reservation id.
create or replace function public.book_equipment(
  boat uuid, erg uuid, starts timestamptz, ends timestamptz, rowers uuid[], note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  staff boolean := public.is_coach_or_admin();
  crew uuid[];
  r uuid;
  problem text;
  new_id uuid;
  open_for_members boolean;
  broken boolean;
begin
  if not public.is_approved() then raise exception 'Not signed in.'; end if;
  if (boat is null) = (erg is null) then raise exception 'Pick a boat or an erg.'; end if;
  if ends <= starts then raise exception 'The end time has to be after the start.'; end if;
  if ends - starts > interval '6 hours' then raise exception 'Bookings can be up to 6 hours.'; end if;
  if ends < now() then raise exception 'That time has already passed.'; end if;
  if starts > now() + interval '60 days' then raise exception 'You can book up to 60 days ahead.'; end if;

  crew := array(select distinct x from unnest(coalesce(rowers, '{}') || auth.uid()) x where x is not null);
  if not staff then
    -- Members book for themselves (and who they row with).
    crew := array(select distinct x from unnest(crew || auth.uid()) x);
  end if;

  if boat is not null then
    select bookable, out_of_service into open_for_members, broken from boats where id = boat;
  else
    select bookable, out_of_service into open_for_members, broken from ergs where id = erg;
  end if;
  if open_for_members is null then raise exception 'That boat or erg is gone.'; end if;
  if broken then raise exception 'That one is out of service.'; end if;
  if not open_for_members and not staff then
    raise exception 'Only coaches can book that one.';
  end if;

  if boat is not null and not staff then
    foreach r in array crew loop
      problem := public.boat_rower_problem(boat, r);
      if problem is not null then raise exception '%', problem; end if;
    end loop;
  end if;

  -- One booking at a time per boat or erg.
  perform pg_advisory_xact_lock(hashtext(coalesce(boat, erg)::text));
  if exists (
    select 1 from boat_reservations
    where (boat_id = boat or erg_id = erg)
      and tstzrange(starts_at, ends_at) && tstzrange(starts, ends)
  ) then
    raise exception 'Someone already has it then. Pick another time.';
  end if;

  insert into boat_reservations (boat_id, erg_id, booked_by, rower_ids, starts_at, ends_at, note)
  values (boat, erg, auth.uid(), crew, starts, ends, nullif(left(trim(coalesce(note, '')), 200), ''))
  returning id into new_id;
  return new_id;
end;
$$;

revoke execute on function public.book_equipment(uuid, uuid, timestamptz, timestamptz, uuid[], text) from public, anon;
grant execute on function public.book_equipment(uuid, uuid, timestamptz, timestamptz, uuid[], text) to authenticated;

-- Take a boat out. Returns the sign-out id.
create or replace function public.sign_out_boat(boat uuid, rowers uuid[], back_by timestamptz, route_text text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  staff boolean := public.is_coach_or_admin();
  crew uuid[];
  r uuid;
  problem text;
  b boats%rowtype;
  new_id uuid;
begin
  if not public.is_approved() then raise exception 'Not signed in.'; end if;
  select * into b from boats where id = boat;
  if b.id is null then raise exception 'That boat is gone.'; end if;
  if b.out_of_service then raise exception '% is out of service.', b.name; end if;
  if not b.bookable and not staff then raise exception 'Only coaches can take % out.', b.name; end if;
  if back_by <= now() then raise exception 'Pick when you''ll be back.'; end if;
  if back_by > now() + interval '8 hours' then raise exception 'Sign out for up to 8 hours.'; end if;

  crew := array(select distinct x from unnest(coalesce(rowers, '{}')) x where x is not null);
  if not staff then
    crew := array(select distinct x from unnest(crew || auth.uid()) x);
  end if;
  if cardinality(crew) = 0 then raise exception 'Who''s rowing?'; end if;

  if not staff then
    foreach r in array crew loop
      problem := public.boat_rower_problem(boat, r);
      if problem is not null then raise exception '%', problem; end if;
    end loop;
    -- Someone else's booking right now.
    if exists (
      select 1 from boat_reservations
      where boat_id = boat and now() >= starts_at - interval '15 minutes' and now() < ends_at
        and not (auth.uid() = any (rower_ids) or booked_by = auth.uid())
    ) then
      raise exception '% is booked by someone else right now.', b.name;
    end if;
  end if;

  if exists (select 1 from boat_signouts where boat_id = boat and back_at is null) then
    raise exception '% is already out.', b.name;
  end if;

  insert into boat_signouts (boat_id, rower_ids, signed_out_by, expected_back_at, route)
  values (boat, crew, auth.uid(), back_by, nullif(left(trim(coalesce(route_text, '')), 120), ''))
  returning id into new_id;
  return new_id;
end;
$$;

revoke execute on function public.sign_out_boat(uuid, uuid[], timestamptz, text) from public, anon;
grant execute on function public.sign_out_boat(uuid, uuid[], timestamptz, text) to authenticated;

-- Bring it back: anyone in the crew, or a coach/admin. Damage becomes a
-- Boat Maintenance request.
create or replace function public.sign_in_boat(signout uuid, km numeric, damage_text text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s boat_signouts%rowtype;
  dmg text := nullif(left(trim(coalesce(damage_text, '')), 1000), '');
begin
  select * into s from boat_signouts where id = signout for update;
  if s.id is null then raise exception 'That sign-out is gone.'; end if;
  if s.back_at is not null then raise exception 'It''s already signed back in.'; end if;
  if not (auth.uid() = any (s.rower_ids) or s.signed_out_by = auth.uid() or public.is_coach_or_admin()) then
    raise exception 'Only the crew or a coach can sign it back in.';
  end if;
  if km is not null and (km < 0 or km > 100) then raise exception 'Distance looks off (0 to 100 km).'; end if;

  update boat_signouts
  set back_at = now(), signed_in_by = auth.uid(),
      meters = case when km is null then null else round(km * 1000)::integer end,
      damage = dmg
  where id = signout;

  if dmg is not null then
    insert into maintenance_requests (type, boat_id, description, submitted_by, club_id)
    values ('boat', s.boat_id, 'Reported at sign-in: ' || dmg, auth.uid(), s.club_id);
  end if;
end;
$$;

revoke execute on function public.sign_in_boat(uuid, numeric, text) from public, anon;
grant execute on function public.sign_in_boat(uuid, numeric, text) to authenticated;

select public.apply_club_isolation();
select public.apply_approval_gate();
