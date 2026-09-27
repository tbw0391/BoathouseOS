-- Rowers and coxswains tap Check in on the home page when they get to
-- practice, or "I won't be at practice" with a reason. One row per person per
-- Eastern calendar day; tapping again changes it. Coaches and admins see the
-- day's list on /coach/attendance.

create table practice_attendance (
  profile_id uuid not null references profiles (id) on delete cascade,
  practice_date date not null,
  status text not null check (status in ('checked_in', 'absent')),
  reason text,
  responded_at timestamptz not null default now(),
  primary key (profile_id, practice_date)
);

alter table practice_attendance enable row level security;

create policy "members read their own attendance, coaches read all"
  on practice_attendance for select
  to authenticated
  using (
    auth.uid() = profile_id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin'))
  );

create policy "rowers and coxswains record their own attendance"
  on practice_attendance for insert
  to authenticated
  with check (
    auth.uid() = profile_id
    and exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('rower', 'coxswain'))
  );

create policy "rowers and coxswains change their own attendance"
  on practice_attendance for update
  to authenticated
  using (auth.uid() = profile_id)
  with check (
    auth.uid() = profile_id
    and exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('rower', 'coxswain'))
  );

create policy "rowers and coxswains clear their own attendance"
  on practice_attendance for delete
  to authenticated
  using (auth.uid() = profile_id);

create index practice_attendance_date_idx on practice_attendance (practice_date);
