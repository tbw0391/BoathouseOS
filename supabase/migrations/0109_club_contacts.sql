-- Who to ask: board titles, committees, and the contacts page.
--
-- - profiles.club_title: a title shown next to someone's name ("President",
--   "Head coach"). Only admins can set it, like the board member flag.
-- - committees and committee_members: groups an admin makes (Apparel,
--   Fundraising, Regatta...) with members and chairs. Every approved member
--   of the club can read them; only admins change them.
-- - my_club_suspended(): lets /pending say "your club is paused" (0107).
--   Unapproved members can't read their club's row, so it asks this instead.
--
-- Safe to re-run.

alter table public.profiles add column if not exists club_title text;

-- Same guard as 0103, plus club_title.
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
      or new.club_title is distinct from old.club_title)
     and caller_role is distinct from 'admin' then
    raise exception 'Only admins can change role, approval, board member, tent leader, treasurer, apparel chair, or title.';
  end if;

  if new.disabled_at is distinct from old.disabled_at
     and coalesce(caller_role, '') not in ('admin', 'coach') then
    raise exception 'Only coaches and admins can remove or restore members.';
  end if;

  return new;
end;
$$;

create table if not exists public.committees (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null default public.default_club_id() references public.clubs (id),
  name text not null check (length(trim(name)) > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists committees_club_id_idx on public.committees (club_id);

create table if not exists public.committee_members (
  committee_id uuid not null references public.committees (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  club_id uuid not null default public.default_club_id() references public.clubs (id),
  is_chair boolean not null default false,
  primary key (committee_id, profile_id)
);

create index if not exists committee_members_club_id_idx on public.committee_members (club_id);
create index if not exists committee_members_profile_id_idx on public.committee_members (profile_id);

alter table public.committees enable row level security;
alter table public.committee_members enable row level security;

drop policy if exists "members read committees" on public.committees;
create policy "members read committees"
  on public.committees for select to authenticated using (true);
drop policy if exists "admins manage committees" on public.committees;
create policy "admins manage committees"
  on public.committees for all to authenticated
  using ((select public.is_club_admin())) with check ((select public.is_club_admin()));

drop policy if exists "members read committee members" on public.committee_members;
create policy "members read committee members"
  on public.committee_members for select to authenticated using (true);
drop policy if exists "admins manage committee members" on public.committee_members;
create policy "admins manage committee members"
  on public.committee_members for all to authenticated
  using ((select public.is_club_admin())) with check ((select public.is_club_admin()));

-- Approved members only, like every club table (0060).
drop policy if exists "approved members only" on public.committees;
create policy "approved members only" on public.committees as restrictive for all to authenticated
  using ((select public.is_approved())) with check ((select public.is_approved()));
drop policy if exists "approved members only" on public.committee_members;
create policy "approved members only" on public.committee_members as restrictive for all to authenticated
  using ((select public.is_approved())) with check ((select public.is_approved()));

-- "same club only" and club-scoped foreign keys (0103).
select public.apply_club_isolation();

create or replace function public.my_club_suspended()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select c.suspended_at is not null
    from profiles p join clubs c on c.id = p.club_id
    where p.id = auth.uid()
  ), false);
$$;

revoke execute on function public.my_club_suspended() from public, anon;
grant execute on function public.my_club_suspended() to authenticated;
