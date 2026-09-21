-- Maintenance requests: boat-specific (tied to a fleet boat) or site/facility
-- issues. Mirrors the suggestions table's submit-and-review pattern.

create table if not exists maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('boat', 'site')),
  boat_id uuid references boats (id) on delete set null,
  description text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  submitted_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check ((type = 'boat' and boat_id is not null) or (type = 'site' and boat_id is null))
);

alter table maintenance_requests enable row level security;

create policy "people can submit maintenance requests"
  on maintenance_requests for insert
  to authenticated
  with check (submitted_by = auth.uid());

create policy "people can read their own maintenance requests"
  on maintenance_requests for select
  to authenticated
  using (submitted_by = auth.uid());

create policy "staff can read all maintenance requests"
  on maintenance_requests for select
  to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')));

create policy "staff can update maintenance requests"
  on maintenance_requests for update
  to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')));

create policy "staff can delete maintenance requests"
  on maintenance_requests for delete
  to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')));
