-- Coaches and admins tap a green Check in button (home page and their own
-- profile) to record when they arrived. One row per tap; the button reads
-- "Checked in at ..." for the rest of that Eastern calendar day.

create table coach_check_ins (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  checked_in_at timestamptz not null default now()
);

alter table coach_check_ins enable row level security;

create policy "coaches and admins read all check-ins"
  on coach_check_ins for select
  to authenticated
  using (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')
  ));

create policy "coaches and admins check themselves in"
  on coach_check_ins for insert
  to authenticated
  with check (
    auth.uid() = profile_id
    and exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin'))
  );

create index coach_check_ins_profile_checked_in_at_idx
  on coach_check_ins (profile_id, checked_in_at desc);
