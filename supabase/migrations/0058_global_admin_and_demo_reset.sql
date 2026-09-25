-- Global admin + demo reset.
--
-- A global admin sits above the club "admin" role: it's the person who runs
-- the BoatHouseOS demo, not a club officer. Only a global admin can save the
-- demo's baseline snapshot and reset the whole database back to it, undoing
-- everything visitors changed.
--
-- global_admins has RLS on and no policies, so no client can read or write
-- it directly — membership is only ever granted here (or via the SQL editor),
-- never by the app. It's keyed by auth user id rather than email so nobody
-- can claim it by signing up with the address before the real account exists.

create table global_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table global_admins enable row level security;

insert into global_admins (user_id)
select id from auth.users where lower(email) = 'tbw0391@gmail.com'
on conflict do nothing;

update profiles set role = 'admin'
where id in (select user_id from global_admins);

create or replace function public.is_global_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from global_admins where user_id = auth.uid());
$$;

revoke execute on function public.is_global_admin() from public, anon;
grant execute on function public.is_global_admin() to authenticated;

-- Snapshot storage. Not exposed through the API (only public is), and
-- locked down anyway.
create schema if not exists demo_baseline;
revoke all on schema demo_baseline from public, anon, authenticated;

-- Tables the snapshot/reset never touches.
create or replace function demo_baseline.excluded_tables()
returns text[]
language sql
immutable
as $$
  select array['global_admins']::text[];
$$;

-- Copy every public table into demo_baseline, replacing any earlier snapshot.
-- Also records which auth users exist, so reset can remove accounts created
-- afterwards.
create or replace function public.demo_save_baseline()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
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
    select tablename from pg_tables
    where schemaname = 'public'
      and tablename <> all (demo_baseline.excluded_tables())
  loop
    execute format('create table demo_baseline.%I as table public.%I', t, t);
  end loop;

  create table demo_baseline._auth_user_ids as select id from auth.users;
  create table demo_baseline._saved_at as select now() as saved_at;
end;
$$;

-- Put every public table back to the saved snapshot and delete any auth
-- accounts created since (except global admins). Foreign keys and triggers
-- are suspended for the duration via session_replication_role so tables can
-- be refilled in any order without firing the app's auto-task triggers.
create or replace function public.demo_reset()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t text;
  cols text;
  tables text;
begin
  if not public.is_global_admin() then
    raise exception 'Only a global admin can reset the demo.';
  end if;

  if not exists (
    select 1 from pg_tables where schemaname = 'demo_baseline' and tablename = '_saved_at'
  ) then
    raise exception 'No demo baseline has been saved yet.';
  end if;

  set local session_replication_role = replica;

  -- Only tables that exist both now and in the snapshot. Tables added by a
  -- later migration are left alone until the baseline is saved again.
  select string_agg(format('public.%I', p.tablename), ', ')
  into tables
  from pg_tables p
  join pg_tables b on b.schemaname = 'demo_baseline' and b.tablename = p.tablename
  where p.schemaname = 'public'
    and p.tablename <> all (demo_baseline.excluded_tables());

  if tables is not null then
    execute 'truncate ' || tables;
  end if;

  for t in
    select p.tablename
    from pg_tables p
    join pg_tables b on b.schemaname = 'demo_baseline' and b.tablename = p.tablename
    where p.schemaname = 'public'
      and p.tablename <> all (demo_baseline.excluded_tables())
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
      and c.is_generated = 'NEVER';

    if cols is not null then
      execute format(
        'insert into public.%I (%s) overriding system value select %s from demo_baseline.%I',
        t, cols, cols, t
      );
    end if;
  end loop;

  delete from auth.users
  where id not in (select id from demo_baseline._auth_user_ids)
    and id not in (select user_id from global_admins);
end;
$$;

revoke execute on function public.demo_save_baseline() from public, anon;
revoke execute on function public.demo_reset() from public, anon;
grant execute on function public.demo_save_baseline() to authenticated;
grant execute on function public.demo_reset() to authenticated;

create or replace function public.demo_baseline_saved_at()
returns timestamptz
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result timestamptz;
begin
  if not public.is_global_admin() then
    return null;
  end if;
  if not exists (
    select 1 from pg_tables where schemaname = 'demo_baseline' and tablename = '_saved_at'
  ) then
    return null;
  end if;
  execute 'select saved_at from demo_baseline._saved_at limit 1' into result;
  return result;
end;
$$;

revoke execute on function public.demo_baseline_saved_at() from public, anon;
grant execute on function public.demo_baseline_saved_at() to authenticated;
