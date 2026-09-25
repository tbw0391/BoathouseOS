-- Admin approval for new members, enforced in the database.
--
-- Self-signups start with approved_at = null ("pending") and can't read or
-- write any club data until an admin approves them. Members removed from
-- the roster (disabled_at set) lose access the same way. Everyone who
-- exists today, and anyone an admin adds from the roster, is approved via
-- the column default.
--
-- Also closes a hole where any signed-in user could promote themselves to
-- admin by updating their own profile through the API: the "users can
-- update their own profile" policy doesn't restrict columns, so privileged
-- columns are now guarded by a trigger.

alter table profiles
  add column approved_at timestamptz default now();

-- Signed-in, approved, and not removed from the roster. Global admins always
-- pass so they can't lock themselves out.
create or replace function public.is_approved()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and approved_at is not null and disabled_at is null
  ) or public.is_global_admin();
$$;

revoke execute on function public.is_approved() from public, anon;
grant execute on function public.is_approved() to authenticated;

-- Approved admin (or global admin): the only people who see pending signups.
create or replace function public.is_club_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin' and approved_at is not null and disabled_at is null
  ) or public.is_global_admin();
$$;

revoke execute on function public.is_club_admin() from public, anon;
grant execute on function public.is_club_admin() to authenticated;

-- Adds a restrictive "must be approved" policy to every public table that
-- doesn't have one yet. Restrictive policies are ANDed with the existing
-- permissive ones, so this narrows access without touching any of them.
-- Future migrations that create tables should end with:
--   select public.apply_approval_gate();
create or replace function public.apply_approval_gate()
returns void
language plpgsql
set search_path = public
as $$
declare
  t text;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public'
      -- club_settings is readable by anon anyway (theme colors on /login);
      -- interest_signups is written through the admin client.
      and tablename not in ('club_settings', 'interest_signups')
      and not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = pg_tables.tablename
          and policyname = 'approved members only'
      )
  loop
    if t = 'profiles' then
      -- Pending members still need their own row (for the pending
      -- screen), and only admins see other people's pending rows, so they
      -- stay out of the roster, lineup pickers, message lists, etc.
      execute format(
        'create policy "approved members only" on public.%I as restrictive for all to authenticated '
        'using (id = auth.uid() or ((select public.is_approved()) '
        'and (approved_at is not null or (select public.is_club_admin())))) '
        'with check ((select public.is_approved()) or id = auth.uid())',
        t
      );
    else
      execute format(
        'create policy "approved members only" on public.%I as restrictive for all to authenticated '
        'using ((select public.is_approved())) with check ((select public.is_approved()))',
        t
      );
    end if;
  end loop;
end;
$$;

revoke execute on function public.apply_approval_gate() from public, anon, authenticated;

select public.apply_approval_gate();

create policy "approved members only"
  on storage.objects as restrictive for all
  to authenticated
  using ((select public.is_approved()))
  with check ((select public.is_approved()));

-- Privileged profile columns. Server actions using the service-role client
-- (auth.uid() is null) are trusted and skip the check.
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

  select p.role::text into caller_role
  from profiles p
  where p.id = auth.uid() and p.approved_at is not null and p.disabled_at is null;

  if (new.role is distinct from old.role
      or new.approved_at is distinct from old.approved_at
      or new.is_board_member is distinct from old.is_board_member
      or new.is_tent_leader is distinct from old.is_tent_leader)
     and caller_role is distinct from 'admin' then
    raise exception 'Only admins can change role, approval, board member, or tent leader.';
  end if;

  if new.disabled_at is distinct from old.disabled_at
     and coalesce(caller_role, '') not in ('admin', 'coach') then
    raise exception 'Only coaches and admins can remove or restore members.';
  end if;

  return new;
end;
$$;

create trigger guard_profile_privileged_columns
  before update on profiles
  for each row execute function public.guard_profile_privileged_columns();
