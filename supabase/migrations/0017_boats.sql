-- A reusable fleet of named boats (a physical shell has a fixed name and
-- class, unlike a lineup which is a per-event racing assignment). Lineups
-- can now reference a fleet boat, which fills in its name/class.

create table if not exists boats (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  boat_class text not null,
  notes text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

alter table boats enable row level security;

create policy "boats are readable by authenticated users"
  on boats for select
  to authenticated
  using (true);

create policy "coaches and admins manage boats"
  on boats for all
  to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')));

alter table lineups add column if not exists boat_id uuid references boats (id) on delete set null;
