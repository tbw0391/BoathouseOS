-- Seat racing (Coach > Seat Racing): a session of pieces between two boats,
-- swapping rowers between pieces. Who was in each boat and both times are
-- stored; the swings are worked out in the app (lib/seatRacing.ts).
-- Coaches and admins only. Safe to re-run.

create table if not exists seat_races (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 80),
  raced_on date not null,
  boat_class text not null,
  distance_m integer,
  notes text,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists seat_race_pieces (
  id uuid primary key default gen_random_uuid(),
  seat_race_id uuid not null references seat_races (id) on delete cascade,
  piece_no integer not null,
  boat_a uuid[] not null default '{}',
  boat_b uuid[] not null default '{}',
  time_a numeric(7, 1),
  time_b numeric(7, 1),
  created_at timestamptz not null default now(),
  unique (seat_race_id, piece_no)
);

alter table seat_races enable row level security;
alter table seat_race_pieces enable row level security;

do $$
declare t text;
begin
  foreach t in array array['seat_races', 'seat_race_pieces']
  loop
    execute format('drop policy if exists "coaches and admins run seat races" on %I', t);
    execute format(
      'create policy "coaches and admins run seat races" on %I for all to authenticated '
      || 'using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in (''coach'', ''admin''))) '
      || 'with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role in (''coach'', ''admin'')))',
      t
    );
  end loop;
end $$;

select public.apply_approval_gate();
