-- Support a profile belonging to more than one squad (e.g. a coach who
-- coaches both the men's and women's teams).

create table if not exists profile_teams (
  profile_id uuid not null references profiles (id) on delete cascade,
  team team not null,
  primary key (profile_id, team)
);

-- Carry over each profile's existing single team into the new table, if
-- that column happens to exist on this database (some environments never
-- got the migration that added it).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'profiles' and column_name = 'team'
  ) then
    execute '
      insert into profile_teams (profile_id, team)
      select id, team from profiles where team is not null
      on conflict do nothing
    ';
  end if;
end $$;

-- Coaches oversee the men's, women's, and development squads.
insert into profile_teams (profile_id, team)
select id, t.team
from profiles, unnest(array['mens', 'womens', 'development']::team[]) as t(team)
where role = 'coach'
on conflict do nothing;

alter table profiles drop column if exists team;

alter table profile_teams enable row level security;

create policy "profile teams are readable by authenticated users"
  on profile_teams for select
  to authenticated
  using (true);

create policy "self or staff manage profile teams"
  on profile_teams for all
  to authenticated
  using (
    profile_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin'))
  )
  with check (
    profile_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin'))
  );
