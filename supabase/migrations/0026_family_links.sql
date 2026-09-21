-- Links a parent/guardian profile to a rower/coxswain profile (many-to-many:
-- a rower can have more than one guardian on the roster, a guardian can have
-- more than one rower). Editable from either side's bio. Used to show
-- parents a banner when their rower is added to a lineup.

create table family_links (
  guardian_id uuid not null references profiles (id) on delete cascade,
  rower_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (guardian_id, rower_id),
  check (guardian_id <> rower_id)
);

alter table family_links enable row level security;

create policy "family links are readable by authenticated users"
  on family_links for select
  to authenticated
  using (true);

create policy "either linked side or staff can manage a family link"
  on family_links for all
  to authenticated
  using (
    auth.uid() = guardian_id
    or auth.uid() = rower_id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'coach'))
  )
  with check (
    auth.uid() = guardian_id
    or auth.uid() = rower_id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'coach'))
  );
