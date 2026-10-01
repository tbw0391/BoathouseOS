-- Program registration on the club website (/site/programs): camps, Learn
-- to Row, seasons. Visitors aren't signed in, so registrations are written
-- with the service role (app/site/programs/actions.ts) and never read back
-- on the site.
--
-- - programs: what's offered. Shown on the site once published and
--   between its open/close times. Price is shown only for now (payment
--   comes with Stripe); capacity fills, then registrations go on a
--   waitlist. questions: extra questions as JSON
--   [{id, label, kind: short|long|yes_no|choice, options, required}].
-- - program_registrations: who signed up: the participant (often a
--   minor), a parent/guardian's contact, emergency contact, medical notes,
--   the waiver, answers. Admins and coaches read them; admins change them.
--
-- Safe to re-run.

create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null default public.default_club_id() references public.clubs (id),
  slug text not null check (slug ~ '^[a-z0-9-]{1,60}$'),
  title text not null check (length(trim(title)) > 0),
  description text not null default '',
  starts_on date,
  ends_on date,
  schedule text,
  ages text,
  price_cents integer check (price_cents is null or price_cents >= 0),
  capacity integer check (capacity is null or capacity > 0),
  opens_at timestamptz,
  closes_at timestamptz,
  published boolean not null default false,
  waiver text,
  questions jsonb not null default '[]',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, slug)
);

create index if not exists programs_club_id_idx on public.programs (club_id);

create table if not exists public.program_registrations (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null default public.default_club_id() references public.clubs (id),
  program_id uuid not null references public.programs (id) on delete cascade,
  status text not null default 'registered' check (status in ('registered', 'waitlist', 'cancelled')),
  participant_name text not null,
  participant_birthdate date,
  guardian_name text,
  email text not null,
  phone text,
  emergency_name text,
  emergency_phone text,
  medical_notes text,
  answers jsonb not null default '{}',
  waiver_accepted_at timestamptz,
  paid_at timestamptz,
  notes text,
  ip text,
  created_at timestamptz not null default now()
);

create index if not exists program_registrations_club_id_idx on public.program_registrations (club_id);
create index if not exists program_registrations_program_id_idx on public.program_registrations (program_id, created_at);
create index if not exists program_registrations_ip_idx on public.program_registrations (ip, created_at);

alter table public.programs enable row level security;
alter table public.program_registrations enable row level security;

drop policy if exists "members read programs" on public.programs;
create policy "members read programs"
  on public.programs for select to authenticated using (true);
drop policy if exists "admins manage programs" on public.programs;
create policy "admins manage programs"
  on public.programs for all to authenticated
  using ((select public.is_club_admin())) with check ((select public.is_club_admin()));

drop policy if exists "coaches and admins read registrations" on public.program_registrations;
create policy "coaches and admins read registrations"
  on public.program_registrations for select to authenticated
  using ((select public.is_coach_or_admin()));
drop policy if exists "admins manage registrations" on public.program_registrations;
create policy "admins manage registrations"
  on public.program_registrations for all to authenticated
  using ((select public.is_club_admin())) with check ((select public.is_club_admin()));

select public.apply_approval_gate();
select public.apply_club_isolation();
