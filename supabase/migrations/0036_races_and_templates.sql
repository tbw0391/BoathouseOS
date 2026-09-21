-- Races: a scheduled race entry for a regatta, collected (typically via
-- bulk import of a heat sheet) before any boat/crew is assigned. Once a
-- coach assigns a lineup to it — directly, or by applying a saved lineup
-- template — lineup_id is set and the race is no longer "pending".
create table races (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references schedule_events (id) on delete cascade,
  category text check (category in (
    'mens_varsity', 'mens_novice', 'womens_varsity', 'womens_novice',
    'masters', 'development'
  )),
  race_name text not null,
  race_time timestamptz,
  lineup_id uuid references lineups (id) on delete set null,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

alter table races enable row level security;

create policy "races are readable by authenticated users"
  on races for select
  to authenticated
  using (true);

create policy "coaches and admins manage races"
  on races for all
  to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')));

-- Lineup templates: a reusable named crew (e.g. "Men's 1V8") a coach
-- defines once and applies to any matching race later, picking a physical
-- boat from the fleet at apply-time. A template is not tied to any
-- specific boat — only a boat class, which determines its seat count.
create table lineup_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  boat_class text not null,
  category text check (category in (
    'mens_varsity', 'mens_novice', 'womens_varsity', 'womens_novice',
    'masters', 'development'
  )),
  notes text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

alter table lineup_templates enable row level security;

create policy "lineup templates are readable by authenticated users"
  on lineup_templates for select
  to authenticated
  using (true);

create policy "coaches and admins manage lineup templates"
  on lineup_templates for all
  to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')));

create table lineup_template_seats (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references lineup_templates (id) on delete cascade,
  seat_number int not null,
  seat_role text not null check (seat_role in ('rower', 'coxswain', 'coach')),
  rower_id uuid references profiles (id)
);

alter table lineup_template_seats enable row level security;

create policy "lineup template seats are readable by authenticated users"
  on lineup_template_seats for select
  to authenticated
  using (true);

create policy "coaches and admins manage lineup template seats"
  on lineup_template_seats for all
  to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')));
