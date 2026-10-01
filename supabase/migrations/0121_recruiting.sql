-- College recruiting (recruit.boathouseos.app; /recruit on the demo).
--
-- - recruiters (platform table): college coaches. They sign up with a .edu
--   email, set their password from an emailed link (which proves the
--   address is theirs), and wait for a global admin to approve them. They
--   belong to no club and have no profile, so club isolation keeps them out
--   of every club table; the recruit pages read with the service role after
--   checking they're approved.
-- - recruit_listings: a rower's or coxswain's opt-in. The athlete (or their
--   parent) picks which fields college coaches see. Under-18s (or no
--   birthday on file) also need a parent's approval; an athlete's own
--   change to what's shown clears it. Contact details, address, birthday
--   and medical information are never offered.
-- - recruit_contacts: messages from college coaches, emailed to the
--   athlete's club coaches and parents (and the athlete, if 18 or over).
-- - Each club turns recruiting on in Admin Settings (club_settings
--   "recruiting" = "on"); off by default.
--
-- Safe to re-run.

create table if not exists public.recruiters (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null,
  school text not null,
  title text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.recruiters enable row level security;
-- No policies: read and written by server code with the service role.

create or replace function public.platform_tables()
returns text[]
language sql
immutable
set search_path to ''
as $$
  select array[
    'clubs', 'global_admins', 'interest_signups', 'signup_attempts',
    'error_reports', 'scheduled_alerts_sent',
    'platform_notices', 'platform_notice_dismissals',
    'recruiters'
  ]::text[];
$$;

-- Whether the signed-in account is a college coach's (any status), so the
-- app sends them to the recruit pages instead of a club's.
create or replace function public.is_recruiter()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from recruiters where user_id = auth.uid());
$$;

revoke execute on function public.is_recruiter() from public, anon;
grant execute on function public.is_recruiter() to authenticated, service_role;

create table if not exists public.recruit_listings (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  club_id uuid not null default public.default_club_id() references public.clubs (id),
  shown boolean not null default false,
  fields text[] not null default '{}',
  height text check (char_length(height) <= 20),
  gpa text check (char_length(gpa) <= 20),
  intended_major text check (char_length(intended_major) <= 100),
  about text check (char_length(about) <= 2000),
  video_url text check (video_url ~ '^https://' and char_length(video_url) <= 500),
  parent_approved_at timestamptz,
  parent_approved_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists recruit_listings_club_id_idx on public.recruit_listings (club_id);

alter table public.recruit_listings enable row level security;

drop policy if exists "athletes, their parents, coaches and admins see listings" on public.recruit_listings;
create policy "athletes, their parents, coaches and admins see listings"
  on public.recruit_listings for select
  to authenticated
  using ((select public.can_act_for(profile_id)));

-- Only the athlete or their parent writes it (not coaches).
drop policy if exists "athletes and their parents write listings" on public.recruit_listings;
create policy "athletes and their parents write listings"
  on public.recruit_listings for all
  to authenticated
  using (
    profile_id = (select auth.uid())
    or exists (select 1 from public.family_links where guardian_id = (select auth.uid()) and rower_id = profile_id)
  )
  with check (
    profile_id = (select auth.uid())
    or exists (select 1 from public.family_links where guardian_id = (select auth.uid()) and rower_id = profile_id)
  );

-- A parent's save records their approval (or withdraws it); the athlete's
-- own change to what's shown clears it.
create or replace function public.recruit_listing_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  if auth.uid() is null then
    return new;
  end if;
  if exists (select 1 from family_links where guardian_id = auth.uid() and rower_id = new.profile_id) then
    if new.parent_approved_at is not null then
      new.parent_approved_at := now();
      new.parent_approved_by := auth.uid();
    else
      new.parent_approved_by := null;
    end if;
  elsif tg_op = 'UPDATE'
    and new.fields is not distinct from old.fields
    and new.height is not distinct from old.height
    and new.gpa is not distinct from old.gpa
    and new.intended_major is not distinct from old.intended_major
    and new.about is not distinct from old.about
    and new.video_url is not distinct from old.video_url
  then
    new.parent_approved_at := old.parent_approved_at;
    new.parent_approved_by := old.parent_approved_by;
  else
    new.parent_approved_at := null;
    new.parent_approved_by := null;
  end if;
  return new;
end;
$$;

drop trigger if exists recruit_listing_approval on public.recruit_listings;
create trigger recruit_listing_approval
  before insert or update on public.recruit_listings
  for each row execute function public.recruit_listing_approval();

create table if not exists public.recruit_contacts (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null default public.default_club_id() references public.clubs (id),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  recruiter_id uuid not null references public.recruiters (user_id) on delete cascade,
  message text not null check (char_length(message) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists recruit_contacts_club_id_idx on public.recruit_contacts (club_id);
create index if not exists recruit_contacts_profile_id_idx on public.recruit_contacts (profile_id);
create index if not exists recruit_contacts_recruiter_id_idx on public.recruit_contacts (recruiter_id, created_at);

alter table public.recruit_contacts enable row level security;

-- Written with the service role when a college coach sends one.
drop policy if exists "athletes, their parents, coaches and admins see contacts" on public.recruit_contacts;
create policy "athletes, their parents, coaches and admins see contacts"
  on public.recruit_contacts for select
  to authenticated
  using ((select public.can_act_for(profile_id)));

select public.apply_club_isolation();
select public.apply_approval_gate();
