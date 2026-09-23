-- Coach Tasks: coaches assign practice/regatta-day tasks (e.g. launch and
-- recovery of boats) to specific rowers, separate from seat assignments in
-- Lineups. Task types are a small reusable list (like the boat fleet) so
-- coaches can add their own custom types beyond the seeded Launch/Recovery.

create table task_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

alter table task_types enable row level security;

create policy "task types are readable by authenticated users"
  on task_types for select
  to authenticated
  using (true);

create policy "coaches and admins manage task types"
  on task_types for all
  to authenticated
  using (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')
  ))
  with check (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')
  ));

insert into task_types (name) values ('Launch'), ('Recovery');

create table coach_tasks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references schedule_events (id) on delete cascade,
  task_type_id uuid not null references task_types (id) on delete restrict,
  notes text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

alter table coach_tasks enable row level security;

create policy "coach tasks are readable by authenticated users"
  on coach_tasks for select
  to authenticated
  using (true);

create policy "coaches and admins manage coach tasks"
  on coach_tasks for all
  to authenticated
  using (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')
  ))
  with check (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')
  ));

create table coach_task_assignments (
  task_id uuid not null references coach_tasks (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

alter table coach_task_assignments enable row level security;

create policy "coach task assignments are readable by authenticated users"
  on coach_task_assignments for select
  to authenticated
  using (true);

create policy "coaches and admins manage coach task assignments"
  on coach_task_assignments for all
  to authenticated
  using (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')
  ))
  with check (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')
  ));

create index coach_tasks_event_id_idx on coach_tasks (event_id);
create index coach_task_assignments_user_id_idx on coach_task_assignments (user_id);
