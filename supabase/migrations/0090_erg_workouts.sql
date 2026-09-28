-- Workouts page: every erg piece a member logs (typed in by them, a parent
-- or a coach, or imported from their Concept2 logbook CSV). A 2K or 5K
-- test also updates the profile's time, so erg_times/PRs (0074) keep
-- working. Only the member, their guardians, coaches and admins can see
-- them. Safe to re-run.

create table if not exists erg_workouts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  done_on date not null,
  piece text not null check (length(piece) between 1 and 60),
  distance_m integer check (distance_m between 1 and 100000),
  time_seconds numeric(8, 1) check (time_seconds > 0 and time_seconds < 36000),
  stroke_rate integer check (stroke_rate between 10 and 60),
  notes text,
  source text not null default 'manual' check (source in ('manual', 'concept2')),
  source_ref text,
  entered_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (distance_m is not null or time_seconds is not null)
);

create index if not exists erg_workouts_profile_idx on erg_workouts (profile_id, done_on desc);
create unique index if not exists erg_workouts_source_ref_idx on erg_workouts (profile_id, source_ref) where source_ref is not null;

alter table erg_workouts enable row level security;

drop policy if exists "self, guardians, coaches and admins see workouts" on erg_workouts;
create policy "self, guardians, coaches and admins see workouts"
  on erg_workouts for select
  to authenticated
  using (public.can_act_for(profile_id));

drop policy if exists "self, guardians, coaches and admins log workouts" on erg_workouts;
create policy "self, guardians, coaches and admins log workouts"
  on erg_workouts for all
  to authenticated
  using (public.can_act_for(profile_id))
  with check (public.can_act_for(profile_id));

select public.apply_approval_gate();
