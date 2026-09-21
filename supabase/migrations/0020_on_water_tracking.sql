-- Coxswain on-the-water GPS tracking: a coxswain-started session while the
-- boat is out, plus a trail of location pings streamed live to coaches for
-- safety. Foreground-only (screen-on) tracking; see app/on-water for the UI.

create table on_water_sessions (
  id uuid primary key default gen_random_uuid(),
  lineup_id uuid references lineups (id) on delete set null,
  coxswain_id uuid not null references profiles (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

alter table on_water_sessions enable row level security;

create policy "coaches and admins read all sessions"
  on on_water_sessions for select
  to authenticated
  using (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')
  ));

create policy "coxswain reads their own sessions"
  on on_water_sessions for select
  to authenticated
  using (auth.uid() = coxswain_id);

create policy "eligible coxswains start their own session"
  on on_water_sessions for insert
  to authenticated
  with check (
    auth.uid() = coxswain_id
    and (
      exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'coxswain')
      or exists (
        select 1 from lineup_seats ls
        where ls.seat_role = 'coxswain'
          and ls.rower_id = auth.uid()
          and (ls.lineup_id = on_water_sessions.lineup_id or on_water_sessions.lineup_id is null)
      )
    )
  );

create policy "coxswain or coach ends a session"
  on on_water_sessions for update
  to authenticated
  using (
    auth.uid() = coxswain_id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin'))
  )
  with check (
    auth.uid() = coxswain_id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin'))
  );

create index on_water_sessions_active_idx on on_water_sessions (coxswain_id) where ended_at is null;

create table location_pings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references on_water_sessions (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  accuracy_m double precision,
  heading_deg double precision,
  speed_mps double precision,
  recorded_at timestamptz not null default now()
);

alter table location_pings enable row level security;

create policy "coaches and admins read all pings"
  on location_pings for select
  to authenticated
  using (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')
  ));

create policy "coxswain reads pings from their own sessions"
  on location_pings for select
  to authenticated
  using (exists (
    select 1 from on_water_sessions s where s.id = location_pings.session_id and s.coxswain_id = auth.uid()
  ));

create policy "coxswain inserts pings into their own active session"
  on location_pings for insert
  to authenticated
  with check (exists (
    select 1 from on_water_sessions s
    where s.id = location_pings.session_id
      and s.coxswain_id = auth.uid()
      and s.ended_at is null
  ));

create index location_pings_session_recorded_idx on location_pings (session_id, recorded_at);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'location_pings'
  ) then
    alter publication supabase_realtime add table location_pings;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'on_water_sessions'
  ) then
    alter publication supabase_realtime add table on_water_sessions;
  end if;
end $$;
