-- Multi-club, phase 1: every club's data is walled off from every other
-- club's, enforced in the database.
--
-- - `clubs` lists the clubs. Everything already here becomes the demo club
--   ("BoathouseOS Demo", slug 'demo'). The 95 clubs on /choose-club stay a
--   demo-only look (colors + the races/lineups `club_slug` filter) inside it.
-- - Every club table gets `club_id`. It fills itself in from the signed-in
--   member's own club (default_club_id()), so app inserts don't have to pass
--   it. Server code using the service role (no signed-in member) must pass
--   it — while there's only one club it falls back to that one, and once a
--   second club exists a missing club_id fails instead of guessing.
-- - One restrictive policy per table, "same club only", like the approval
--   gate (0060): a member only ever sees or writes rows of their own club,
--   on top of whatever the table's own policies allow. Global admins are
--   walled in too; seeing across clubs goes through the service role.
-- - Foreign keys between club tables include club_id, so a row can never
--   point at another club's row (a lineup seat at another club's lineup,
--   a family link to another club's rower, ...).
-- - Keys that were one-per-app become one-per-club: club settings, payment
--   settings, the team and board chats, boat and task type names, the
--   day's practice call.
-- - SECURITY DEFINER functions and triggers that skip RLS stay in the club.
-- - Uploads, edits and deletes in the avatars, photos and regatta-artwork
--   buckets are limited to your own club's folders. Those buckets are
--   public, so anyone with a file's link can still view it, same as before.
-- - The demo reset only touches the demo club.
--
-- New tables: add `club_id uuid not null default public.default_club_id()
-- references public.clubs (id)` (unless it's a platform table listed in
-- platform_tables()) and end the migration with
-- `select public.apply_club_isolation();` and `select public.apply_approval_gate();`.
--
-- Not re-runnable: it stops at the first line if clubs already exists.

begin;

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  created_at timestamptz not null default now()
);

alter table public.clubs enable row level security;

insert into public.clubs (name, slug) values ('BoathouseOS Demo', 'demo');

-- Tables that belong to BoathouseOS itself rather than to a club.
create or replace function public.platform_tables()
returns text[]
language sql
immutable
set search_path to ''
as $$
  select array[
    'clubs', 'global_admins', 'interest_signups', 'signup_attempts',
    'error_reports', 'scheduled_alerts_sent'
  ]::text[];
$$;

-- Every existing row goes to the demo club. A constant default fills
-- existing rows without firing any triggers; it's swapped for
-- default_club_id() below.
do $$
declare
  demo uuid := (select id from public.clubs where slug = 'demo');
  t text;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public' and tablename <> all (public.platform_tables())
    order by tablename
  loop
    execute format(
      'alter table public.%I add column club_id uuid not null default %L references public.clubs (id)',
      t, demo
    );
    execute format('create index %I on public.%I (club_id)', left(t, 50) || '_club_id_idx', t);
  end loop;
end;
$$;

-- The signed-in member's club.
create or replace function public.current_club_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select club_id from profiles where id = auth.uid();
$$;

-- What a new row's club_id defaults to: the signed-in member's club, or,
-- with nobody signed in (service role, cron), the only club if there's
-- just one. Null otherwise, which the not-null column turns into an error.
create or replace function public.default_club_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select club_id from profiles where id = auth.uid()),
    (select id from clubs where (select count(*) from clubs) = 1)
  );
$$;

-- The club whose settings (colors, name) signed-out pages like /login and
-- /welcome show. On boathouseos.app that's the demo.
create or replace function public.site_club_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from clubs where slug = 'demo';
$$;

revoke execute on function public.current_club_id() from public, anon;
revoke execute on function public.default_club_id() from public, anon;
grant execute on function public.current_club_id() to authenticated, service_role;
-- The column default runs as whoever inserts, server code included.
grant execute on function public.default_club_id() to authenticated, service_role;
grant execute on function public.site_club_id() to anon, authenticated;

do $$
declare
  t text;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public' and tablename <> all (public.platform_tables())
  loop
    execute format('alter table public.%I alter column club_id set default public.default_club_id()', t);
  end loop;
end;
$$;

-- One-per-app keys become one-per-club.
alter table public.club_settings drop constraint club_settings_pkey;
alter table public.club_settings add primary key (club_id, key);

alter table public.payment_settings drop constraint payment_settings_pkey;
alter table public.payment_settings add primary key (club_id);
-- The Stripe webhook finds the club from the connected account.
alter table public.payment_settings add constraint payment_settings_stripe_account_id_key unique (stripe_account_id);

-- Each new club starts with its own payment settings row (the payments
-- pages expect one).
create or replace function public.create_club_payment_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into payment_settings (club_id, default_fee_mode) values (new.id, 'payer') on conflict do nothing;
  return new;
end;
$$;

revoke execute on function public.create_club_payment_settings() from public, anon, authenticated;

create trigger clubs_payment_settings
  after insert on public.clubs
  for each row execute function public.create_club_payment_settings();

alter table public.practice_calls drop constraint practice_calls_pkey;
alter table public.practice_calls add primary key (club_id, practice_date);

alter table public.chat_groups drop constraint chat_groups_team_key;
alter table public.chat_groups add constraint chat_groups_club_id_team_key unique (club_id, team);
drop index public.chat_groups_one_board;
create unique index chat_groups_one_board on public.chat_groups (club_id) where is_board;

alter table public.boats drop constraint boats_name_key;
alter table public.boats add constraint boats_club_id_name_key unique (club_id, name);

alter table public.task_types drop constraint task_types_name_key;
alter table public.task_types add constraint task_types_club_id_name_key unique (club_id, name);

-- The "same club only" policy on every club table, and club_id in every
-- foreign key between club tables. Safe to run again; migrations adding a
-- club table call it at the end.
create or replace function public.apply_club_isolation()
returns void
language plpgsql
set search_path = public
as $$
declare
  r record;
  cols text;
  refcols text;
  parent_key smallint[];
  on_delete text;
begin
  for r in
    select c.table_name as t
    from information_schema.columns c
    join pg_tables p on p.schemaname = 'public' and p.tablename = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'club_id'
      and c.table_name <> all (public.platform_tables())
      and not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = c.table_name and policyname = 'same club only'
      )
  loop
    execute format(
      'create policy "same club only" on public.%I as restrictive for all to authenticated '
      'using (club_id = (select public.current_club_id())) '
      'with check (club_id = (select public.current_club_id()))',
      r.t
    );
  end loop;

  for r in
    select con.conname, con.conrelid, con.confrelid, con.conkey, con.confkey, con.confdeltype,
           ca.attnum as child_club, pa.attnum as parent_club
    from pg_constraint con
    join pg_attribute ca on ca.attrelid = con.conrelid and ca.attname = 'club_id' and not ca.attisdropped
    join pg_attribute pa on pa.attrelid = con.confrelid and pa.attname = 'club_id' and not pa.attisdropped
    where con.contype = 'f'
      and con.connamespace = 'public'::regnamespace
      and con.confrelid <> 'public.clubs'::regclass
      and not ca.attnum = any (con.conkey)
  loop
    select string_agg(quote_ident(a.attname), ', ' order by k.ord) into cols
    from unnest(r.conkey) with ordinality k (n, ord)
    join pg_attribute a on a.attrelid = r.conrelid and a.attnum = k.n;

    select string_agg(quote_ident(a.attname), ', ' order by k.ord) into refcols
    from unnest(r.confkey) with ordinality k (n, ord)
    join pg_attribute a on a.attrelid = r.confrelid and a.attnum = k.n;

    -- The parent needs a unique key on (its referenced columns, club_id).
    parent_key := (select array_agg(x order by x) from unnest(r.confkey || r.parent_club) x);
    if not exists (
      select 1 from pg_constraint u
      where u.conrelid = r.confrelid and u.contype in ('p', 'u')
        and (select array_agg(x order by x) from unnest(u.conkey) x) = parent_key
    ) then
      execute format(
        'alter table %s add constraint %I unique (%s, club_id)',
        r.confrelid::regclass,
        left((select relname from pg_class where oid = r.confrelid) || '_' || replace(refcols, ', ', '_'), 50) || '_club_id_key',
        refcols
      );
    end if;

    on_delete := case r.confdeltype
      when 'c' then 'cascade'
      when 'n' then format('set null (%s)', cols)
      when 'r' then 'restrict'
      when 'd' then format('set default (%s)', cols)
      else 'no action'
    end;

    execute format(
      'alter table %s drop constraint %I, add constraint %I foreign key (%s, club_id) references %s (%s, club_id) on delete %s',
      r.conrelid::regclass, r.conname, r.conname, cols, r.confrelid::regclass, refcols, on_delete
    );
  end loop;
end;
$$;

revoke execute on function public.apply_club_isolation() from public, anon, authenticated;

select public.apply_club_isolation();

-- Members see their own club's row.
create policy "members see their own club"
  on public.clubs for select
  to authenticated
  using (id = (select public.current_club_id()) or (select public.is_global_admin()));

-- club_settings is readable signed out (colors on /login): only the site's
-- own club there. Signed-in members get their own club via "same club only".
create policy "signed-out pages see the site club"
  on public.club_settings as restrictive for select
  to anon
  using (club_id = (select public.site_club_id()));

-- Members can't move themselves (or anyone) to another club.
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
      or new.is_apparel_chair is distinct from old.is_apparel_chair)
     and caller_role is distinct from 'admin' then
    raise exception 'Only admins can change role, approval, board member, tent leader, treasurer, or apparel chair.';
  end if;

  if new.disabled_at is distinct from old.disabled_at
     and coalesce(caller_role, '') not in ('admin', 'coach') then
    raise exception 'Only coaches and admins can remove or restore members.';
  end if;

  return new;
end;
$$;

-- SECURITY DEFINER functions skip RLS, so each one stays in the club itself.

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
    or exists (
      select 1 from profiles me join profiles them on them.id = person and them.club_id = me.club_id
      where me.id = auth.uid() and me.role in ('coach', 'admin')
    )
  );
$$;

create or replace function public.create_lineup_chat()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_group_id uuid;
begin
  insert into chat_groups (name, is_direct, created_by, club_id)
  values (NEW.boat_name, false, NEW.created_by, NEW.club_id)
  returning id into new_group_id;

  NEW.chat_group_id := new_group_id;
  return NEW;
end;
$$;

create or replace function public.generate_regatta_prep()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  regatta record;
  prior_event_id uuid;
begin
  for regatta in
    select e.id, e.starts_at, e.club_id
    from schedule_events e
    where e.event_type = 'regatta'
      and e.starts_at::date = (now()::date + interval '7 days')::date
      -- Idempotent (safe if the daily job runs more than once) and never
      -- overwrites a food list someone already started building by hand.
      and not exists (select 1 from food_tent_status s where s.event_id = e.id)
      and not exists (select 1 from food_tent_items fi where fi.event_id = e.id)
  loop
    insert into food_tent_status (event_id, status, draft_generated_at, club_id)
    values (regatta.id, 'pending_confirmation', now(), regatta.club_id);

    select fi.event_id into prior_event_id
    from food_tent_items fi
    join schedule_events pe on pe.id = fi.event_id
    where pe.event_type = 'regatta'
      and pe.club_id = regatta.club_id
      and pe.starts_at < regatta.starts_at
    order by pe.starts_at desc
    limit 1;

    if prior_event_id is not null then
      insert into food_tent_items (event_id, title, quantity_needed, notes, published, club_id)
      select regatta.id, title, quantity_needed, notes, false, regatta.club_id
      from food_tent_items
      where event_id = prior_event_id;
    end if;
  end loop;
end;
$$;

create or replace function public.log_erg_times()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  d text;
  new_text text;
  old_text text;
  secs numeric;
  best numeric;
begin
  foreach d in array array['2k', '5k'] loop
    new_text := case d when '2k' then new.erg_2k_time else new.erg_5k_time end;
    old_text := case when tg_op = 'UPDATE'
      then case d when '2k' then old.erg_2k_time else old.erg_5k_time end end;
    secs := erg_seconds(new_text);
    if secs is null or new_text is not distinct from old_text then
      continue;
    end if;

    select min(seconds) into best
    from erg_times where profile_id = new.id and distance = d;

    insert into erg_times (profile_id, distance, time_text, seconds, previous_best_seconds, is_pr, club_id)
    values (new.id, d, trim(new_text), secs, best, best is not null and secs < best, new.club_id);
  end loop;
  return new;
end;
$$;

create or replace function public.on_water_colors_in_use()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(color), '{}')
  from on_water_sessions
  where ended_at is null and color is not null and coxswain_id <> auth.uid()
    and club_id = public.current_club_id();
$$;

create or replace function public.pick_on_water_color()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  palette text[] := array[
    '#dc2626', '#2563eb', '#16a34a', '#ea580c', '#9333ea',
    '#db2777', '#0d9488', '#ca8a04', '#92400e', '#111827'
  ];
  in_use text[];
  previous text;
  c text;
begin
  if new.color is not null then
    return new;
  end if;

  select coalesce(array_agg(color), '{}') into in_use
  from on_water_sessions
  where ended_at is null and color is not null and club_id = new.club_id;

  select color into previous
  from on_water_sessions
  where coxswain_id = new.coxswain_id and color is not null
  order by started_at desc
  limit 1;

  if previous is not null and previous = any (palette) and not previous = any (in_use) then
    new.color := previous;
    return new;
  end if;

  foreach c in array palette loop
    if not c = any (in_use) then
      new.color := c;
      return new;
    end if;
  end loop;

  new.color := palette[1 + (cardinality(in_use) % cardinality(palette))];
  return new;
end;
$$;

create or replace function public.sync_board_chat_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  board_group_id uuid;
begin
  select id into board_group_id from chat_groups where is_board and club_id = new.club_id;
  if board_group_id is null then
    return new;
  end if;

  if new.is_board_member then
    insert into chat_group_members (group_id, user_id, club_id)
    values (board_group_id, new.id, new.club_id)
    on conflict do nothing;
  elsif tg_op = 'UPDATE' and old.is_board_member then
    delete from chat_group_members
    where group_id = board_group_id and user_id = new.id;
  end if;
  return new;
end;
$$;

create or replace function public.sync_lineup_seat_chat_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_group_id uuid;
begin
  select chat_group_id into target_group_id
  from lineups where id = coalesce(NEW.lineup_id, OLD.lineup_id);

  if target_group_id is null then
    return NEW;
  end if;

  if TG_OP = 'INSERT' then
    if NEW.rower_id is not null then
      insert into chat_group_members (group_id, user_id, club_id)
      values (target_group_id, NEW.rower_id, NEW.club_id)
      on conflict do nothing;
    end if;
    return NEW;
  end if;

  if TG_OP = 'UPDATE' and NEW.rower_id is distinct from OLD.rower_id then
    if NEW.rower_id is not null then
      insert into chat_group_members (group_id, user_id, club_id)
      values (target_group_id, NEW.rower_id, NEW.club_id)
      on conflict do nothing;
    end if;

    if OLD.rower_id is not null and not exists (
      select 1 from lineup_seats
      where lineup_id = OLD.lineup_id and rower_id = OLD.rower_id and id <> OLD.id
    ) then
      delete from chat_group_members
      where group_id = target_group_id and user_id = OLD.rower_id;
    end if;
  end if;

  return NEW;
end;
$$;

create or replace function public.sync_team_chat_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_group_id uuid;
begin
  if TG_OP = 'INSERT' then
    select id into target_group_id from chat_groups where team = NEW.team and club_id = NEW.club_id;
    if target_group_id is not null then
      insert into chat_group_members (group_id, user_id, club_id)
      values (target_group_id, NEW.profile_id, NEW.club_id)
      on conflict do nothing;
    end if;
    return NEW;
  elsif TG_OP = 'DELETE' then
    select id into target_group_id from chat_groups where team = OLD.team and club_id = OLD.club_id;
    if target_group_id is not null then
      delete from chat_group_members
      where group_id = target_group_id and user_id = OLD.profile_id;
    end if;
    return OLD;
  end if;
  return null;
end;
$$;

create or replace function public.take_travel_seat(vehicle uuid, person uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ev uuid;
  cap integer;
  club uuid;
  taken integer;
begin
  if not public.can_act_for(person) then
    raise exception 'You can only sign up yourself or your own rower.';
  end if;
  select event_id, seats, club_id into ev, cap, club
  from travel_vehicles where id = vehicle and club_id = public.current_club_id() for update;
  if ev is null then raise exception 'That ride is gone.'; end if;
  select count(*) into taken from travel_riders where vehicle_id = vehicle and profile_id <> person;
  if taken >= cap then raise exception 'That ride is full.'; end if;
  delete from travel_riders where event_id = ev and profile_id = person;
  insert into travel_riders (vehicle_id, event_id, profile_id, added_by, club_id)
  values (vehicle, ev, person, auth.uid(), club);
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
  delete from travel_riders
  where vehicle_id = vehicle and profile_id = person and club_id = public.current_club_id();
end;
$$;

create or replace function public.set_order_handout(order_id uuid, new_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_apparel_manager() then
    raise exception 'Only the apparel chair, treasurer or an admin can do that.';
  end if;
  if new_status not in ('picked_up', 'cancelled') then
    raise exception 'Orders can only be marked picked up or cancelled here.';
  end if;
  update orders
    set status = new_status,
        picked_up_at = case when new_status = 'picked_up' then now() end
    where id = order_id and club_id = public.current_club_id();
end;
$$;

create or replace function public.set_trailer_item_packed(item_id uuid, leg text, packed boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_approved() then
    raise exception 'Only club members can update the trailer list.';
  end if;
  if leg = 'out' then
    update trailer_items
      set packed_out_at = case when packed then now() end,
          packed_out_by = case when packed then auth.uid() end
      where id = item_id and club_id = public.current_club_id();
  elsif leg = 'home' then
    update trailer_items
      set packed_home_at = case when packed then now() end,
          packed_home_by = case when packed then auth.uid() end
      where id = item_id and club_id = public.current_club_id();
  else
    raise exception 'Unknown leg.';
  end if;
end;
$$;

-- Storage: uploads, edits and deletes only in your own club's folders.
-- avatars/<profile id>/..., photos/<uploader id>/..., regatta-artwork/<event id>/...
create or replace function public.storage_folder_in_my_club(bucket text, object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when bucket in ('avatars', 'photos') then exists (
      select 1 from profiles
      where id::text = (storage.foldername(object_name))[1] and club_id = public.current_club_id()
    )
    when bucket = 'regatta-artwork' then exists (
      select 1 from schedule_events
      where id::text = (storage.foldername(object_name))[1] and club_id = public.current_club_id()
    )
    else true
  end;
$$;

revoke execute on function public.storage_folder_in_my_club(text, text) from public, anon;
grant execute on function public.storage_folder_in_my_club(text, text) to authenticated;

create policy "same club only (upload)"
  on storage.objects as restrictive for insert
  to authenticated
  with check (public.storage_folder_in_my_club(bucket_id, name));

create policy "same club only (update)"
  on storage.objects as restrictive for update
  to authenticated
  using (public.storage_folder_in_my_club(bucket_id, name))
  with check (public.storage_folder_in_my_club(bucket_id, name));

create policy "same club only (delete)"
  on storage.objects as restrictive for delete
  to authenticated
  using (public.storage_folder_in_my_club(bucket_id, name));

-- Demo baseline and reset: only the demo club's rows and accounts. Other
-- clubs, and platform tables (interest signups, error reports), are never
-- touched.
create or replace function public.demo_save_baseline()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  demo uuid := (select id from clubs where slug = 'demo');
  t text;
begin
  if not public.is_global_admin() then
    raise exception 'Only a global admin can save the demo baseline.';
  end if;

  for t in
    select tablename from pg_tables where schemaname = 'demo_baseline'
  loop
    execute format('drop table demo_baseline.%I', t);
  end loop;

  for t in
    select p.tablename from pg_tables p
    where p.schemaname = 'public'
      and p.tablename <> all (demo_baseline.excluded_tables())
      and p.tablename <> all (public.platform_tables())
  loop
    execute format(
      'create table demo_baseline.%I as select * from public.%I where club_id = %L',
      t, t, demo
    );
  end loop;

  create table demo_baseline._auth_user_ids as
    select id from auth.users where id in (select id from profiles where club_id = demo);
  create table demo_baseline._saved_at as select now() as saved_at;
end;
$$;

-- Puts the demo club's rows back to the saved snapshot and deletes demo
-- accounts created since (never global admins). Foreign keys and triggers
-- are suspended for the duration via session_replication_role so tables
-- can be refilled in any order without firing the app's auto-task triggers.
create or replace function public.demo_reset()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  demo uuid := (select id from clubs where slug = 'demo');
  t text;
  cols text;
  new_users uuid[];
begin
  if not public.is_global_admin() then
    raise exception 'Only a global admin can reset the demo.';
  end if;

  if not exists (
    select 1 from pg_tables where schemaname = 'demo_baseline' and tablename = '_saved_at'
  ) then
    raise exception 'No demo baseline has been saved yet.';
  end if;

  -- Demo accounts made since the snapshot (their profiles go below).
  select coalesce(array_agg(p.id), '{}') into new_users
  from profiles p
  where p.club_id = demo
    and p.id not in (select id from demo_baseline._auth_user_ids)
    and p.id not in (select user_id from global_admins);

  set local session_replication_role = replica;

  -- Only tables that exist both now and in the snapshot. Tables added by a
  -- later migration are left alone until the baseline is saved again.
  for t in
    select p.tablename
    from pg_tables p
    join pg_tables b on b.schemaname = 'demo_baseline' and b.tablename = p.tablename
    where p.schemaname = 'public'
      and p.tablename <> all (demo_baseline.excluded_tables())
      and p.tablename <> all (public.platform_tables())
  loop
    execute format('delete from public.%I where club_id = %L', t, demo);
  end loop;

  for t in
    select p.tablename
    from pg_tables p
    join pg_tables b on b.schemaname = 'demo_baseline' and b.tablename = p.tablename
    where p.schemaname = 'public'
      and p.tablename <> all (demo_baseline.excluded_tables())
      and p.tablename <> all (public.platform_tables())
  loop
    -- Copy only columns present in both, so a column added since the
    -- snapshot falls back to its default instead of breaking the reset.
    select string_agg(format('%I', c.column_name), ', ' order by c.ordinal_position)
    into cols
    from information_schema.columns c
    join information_schema.columns bc
      on bc.table_schema = 'demo_baseline'
     and bc.table_name = c.table_name
     and bc.column_name = c.column_name
    where c.table_schema = 'public'
      and c.table_name = t
      and c.column_name <> 'club_id'
      and c.is_generated = 'NEVER';

    if cols is null then
      continue;
    end if;

    -- Snapshots saved before clubs existed have no club_id; all of it was
    -- the demo's.
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'demo_baseline' and table_name = t and column_name = 'club_id'
    ) then
      execute format(
        'insert into public.%I (%s, club_id) overriding system value select %s, club_id from demo_baseline.%I where club_id = %L',
        t, cols, cols, t, demo
      );
    else
      execute format(
        'insert into public.%I (%s, club_id) overriding system value select %s, %L from demo_baseline.%I',
        t, cols, cols, demo, t
      );
    end if;
  end loop;

  delete from auth.users where id = any (new_users);
end;
$$;

select public.apply_approval_gate();

commit;
