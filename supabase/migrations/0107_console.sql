-- The global admin console (admin.boathouseos.app; /console on the demo).
--
-- - Clubs can be suspended: their members are locked out (is_approved() is
--   false for them, like a removed member) until the club is unsuspended.
-- - Platform notices: a message from BoathouseOS to every club (or one),
--   for its admins or everyone, shown on the home page until dismissed.
--   Written by the console with the service role; members only read the
--   ones meant for them.
-- - console_applied_migrations(): what's been applied to this database, for
--   the console's Site health page (service role only).
--
-- Safe to re-run.

alter table public.clubs add column if not exists suspended_at timestamptz;

create or replace function public.is_approved()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles p
    join clubs c on c.id = p.club_id
    where p.id = auth.uid()
      and p.approved_at is not null
      and p.disabled_at is null
      and c.suspended_at is null
  ) or public.is_global_admin();
$$;

-- Tables that belong to BoathouseOS itself rather than to a club (no
-- club_id, skipped by club isolation and the demo reset).
create or replace function public.platform_tables()
returns text[]
language sql
immutable
set search_path to ''
as $$
  select array[
    'clubs', 'global_admins', 'interest_signups', 'signup_attempts',
    'error_reports', 'scheduled_alerts_sent',
    'platform_notices', 'platform_notice_dismissals'
  ]::text[];
$$;

create table if not exists public.platform_notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  audience text not null default 'admins' check (audience in ('admins', 'everyone')),
  -- null: every club.
  club_id uuid references public.clubs (id) on delete cascade,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists platform_notices_club_id_idx on public.platform_notices (club_id);

alter table public.platform_notices enable row level security;

drop policy if exists "members read notices meant for them" on public.platform_notices;
create policy "members read notices meant for them"
  on public.platform_notices for select
  to authenticated
  using (
    (club_id is null or club_id = (select public.current_club_id()))
    and (expires_at is null or expires_at > now())
    and (audience = 'everyone' or (select public.is_club_admin()))
  );

create table if not exists public.platform_notice_dismissals (
  notice_id uuid not null references public.platform_notices (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (notice_id, user_id)
);

create index if not exists platform_notice_dismissals_user_id_idx on public.platform_notice_dismissals (user_id);

alter table public.platform_notice_dismissals enable row level security;

drop policy if exists "members see their own dismissals" on public.platform_notice_dismissals;
create policy "members see their own dismissals"
  on public.platform_notice_dismissals for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "members dismiss for themselves" on public.platform_notice_dismissals;
create policy "members dismiss for themselves"
  on public.platform_notice_dismissals for insert
  to authenticated
  with check (user_id = (select auth.uid()));

-- Production records migrations in ops.applied_migrations
-- (scripts/apply-migrations.mjs); the demo's are in Supabase's own table.
create or replace function public.console_applied_migrations()
returns table (name text, applied_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if to_regclass('ops.applied_migrations') is not null then
    return query execute 'select name::text, applied_at from ops.applied_migrations order by name';
  elsif to_regclass('supabase_migrations.schema_migrations') is not null then
    return query execute
      'select coalesce(name, version)::text, null::timestamptz from supabase_migrations.schema_migrations order by version';
  end if;
end;
$$;

revoke execute on function public.console_applied_migrations() from public, anon, authenticated;
grant execute on function public.console_applied_migrations() to service_role;
