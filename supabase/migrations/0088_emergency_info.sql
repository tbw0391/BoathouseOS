-- Emergency contacts and medical notes per member, for coaches on the dock.
-- Sensitive: only the member, their guardians (family_links), coaches and
-- admins can read or change a row (can_act_for from 0086). Safe to re-run.

create table if not exists emergency_info (
  profile_id uuid primary key references profiles (id) on delete cascade,
  contact1_name text,
  contact1_relation text,
  contact1_phone text,
  contact2_name text,
  contact2_relation text,
  contact2_phone text,
  allergies text,
  medications text,
  medical_notes text,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles (id) on delete set null
);

alter table emergency_info enable row level security;

drop policy if exists "self, guardians, coaches and admins see emergency info" on emergency_info;
create policy "self, guardians, coaches and admins see emergency info"
  on emergency_info for select
  to authenticated
  using (public.can_act_for(profile_id));

drop policy if exists "self, guardians, coaches and admins manage emergency info" on emergency_info;
create policy "self, guardians, coaches and admins manage emergency info"
  on emergency_info for all
  to authenticated
  using (public.can_act_for(profile_id))
  with check (public.can_act_for(profile_id));

select public.apply_approval_gate();
