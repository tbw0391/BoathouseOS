-- "I'm interested" leads from people trying the BoatHouseOS demo.
--
-- Anyone signed in (i.e. demo visitors) can add a lead; only a global admin
-- can read them. Excluded from the demo reset so leads survive it.

create table interest_signups (
  id uuid primary key default gen_random_uuid(),
  name text,
  club_name text,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  constraint interest_signups_has_contact check (
    coalesce(nullif(trim(email), ''), nullif(trim(phone), '')) is not null
  )
);

alter table interest_signups enable row level security;

create policy "signed-in users can register interest"
  on interest_signups for insert
  to authenticated
  with check (true);

create policy "global admins can read interest signups"
  on interest_signups for select
  to authenticated
  using (public.is_global_admin());

create or replace function demo_baseline.excluded_tables()
returns text[]
language sql
immutable
as $$
  select array['global_admins', 'interest_signups']::text[];
$$;
