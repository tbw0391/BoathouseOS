-- On the Water simulator: a global admin can put a few pretend boats on Hoover
-- Reservoir to show off live tracking (console, demo site only). Each boat is
-- a real outing for one of the club's coxswains; a pg_cron job every 3
-- seconds moves them up and down the reservoir and adds a GPS ping, the same
-- as a cox's phone would. The job removes itself when the last boat comes in.

create table on_water_sim_boats (
  session_id uuid primary key references on_water_sessions (id) on delete cascade,
  club_id uuid not null references clubs (id) on delete cascade,
  lane double precision not null,   -- 0 = west bank, 1 = east bank
  split_s double precision not null, -- seconds per 500m while rowing
  pos double precision not null,     -- 0 = south end of the stretch, 1 = north end
  dir int not null,                  -- 1 = rowing north, -1 = south
  rest_s double precision not null default 0,
  piece_s double precision not null default 0,
  ends_at timestamptz not null
);

-- Service role and the functions below only.
alter table on_water_sim_boats enable row level security;

-- The water's west and east banks every ~280m from just above the dam
-- (40.1135) to 40.1735, from OpenStreetMap's outline of the reservoir.
create or replace function public.on_water_sim_banks(p_lat double precision)
returns double precision[]
language plpgsql
immutable
set search_path = public
as $$
declare
  lats double precision[] := array[40.1135, 40.116, 40.1185, 40.121, 40.1235, 40.126, 40.1285, 40.1335, 40.136,
    40.1385, 40.141, 40.1485, 40.151, 40.1535, 40.156, 40.1585, 40.161, 40.1635, 40.166, 40.1685, 40.171, 40.1735];
  w double precision[] := array[-82.88555, -82.88514, -82.88494, -82.88539, -82.88582, -82.88643, -82.88605, -82.88399,
    -82.88307, -82.88165, -82.88169, -82.88098, -82.88022, -82.87913, -82.87795, -82.87768, -82.87655, -82.87587,
    -82.87828, -82.87937, -82.87625, -82.87433];
  e double precision[] := array[-82.87834, -82.87475, -82.87774, -82.87595, -82.87714, -82.87548, -82.8751, -82.87274,
    -82.87282, -82.87437, -82.8736, -82.87139, -82.87305, -82.87255, -82.87135, -82.86975, -82.86969, -82.86912,
    -82.86849, -82.86837, -82.86696, -82.86731];
  i int := 2;
  t double precision;
begin
  while i < cardinality(lats) and lats[i] < p_lat loop
    i := i + 1;
  end loop;
  t := (p_lat - lats[i - 1]) / (lats[i] - lats[i - 1]);
  return array[w[i - 1] + t * (w[i] - w[i - 1]), e[i - 1] + t * (e[i] - e[i - 1])];
end;
$$;

-- One step: every simulated boat moves 3 seconds' worth and reports a fix.
create or replace function public.on_water_sim_tick()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  lat0 constant double precision := 40.1135;
  lat1 constant double precision := 40.1735;
  dt constant double precision := 3;
  b on_water_sim_boats%rowtype;
  v double precision;
  v_lat double precision;
  banks double precision[];
  v_lane double precision;
begin
  update on_water_sessions set ended_at = now()
  where ended_at is null and id in (select session_id from on_water_sim_boats where ends_at <= now());
  -- Gone: timed out, or a coach tapped End.
  delete from on_water_sim_boats s
  where s.ends_at <= now()
     or not exists (select 1 from on_water_sessions o where o.id = s.session_id and o.ended_at is null);

  if not exists (select 1 from on_water_sim_boats) then
    perform cron.unschedule(jobid) from cron.job where jobname = 'on-water-sim';
    return;
  end if;

  for b in select * from on_water_sim_boats loop
    v := 0;
    if b.rest_s > 0 then
      b.rest_s := b.rest_s - dt;
    else
      v := 500 / (b.split_s + 6 * sin(extract(epoch from now()) / 20 + b.lane * 10));
      b.pos := b.pos + b.dir * v * dt / ((lat1 - lat0) * 111000);
      b.piece_s := b.piece_s + dt;
      if b.pos > 0.97 or b.pos < 0.03 then
        -- Spin at the end of the stretch.
        b.dir := -b.dir;
        b.pos := least(0.97, greatest(0.03, b.pos));
        b.rest_s := 30;
      elsif b.piece_s > 240 and random() < 0.01 then
        -- Easy between pieces.
        b.rest_s := 45;
        b.piece_s := 0;
      end if;
    end if;

    update on_water_sim_boats
    set pos = b.pos, dir = b.dir, rest_s = b.rest_s, piece_s = b.piece_s
    where session_id = b.session_id;

    v_lat := lat0 + b.pos * (lat1 - lat0);
    banks := on_water_sim_banks(v_lat);
    -- Keep to one side of the water each way.
    v_lane := case when b.dir > 0 then b.lane else 1 - b.lane end;
    insert into location_pings (session_id, club_id, lat, lng, accuracy_m, heading_deg, speed_mps)
    values (
      b.session_id,
      b.club_id,
      v_lat + (random() - 0.5) * 0.00003,
      banks[1] + v_lane * (banks[2] - banks[1]) + (random() - 0.5) * 0.00003,
      4 + random() * 4,
      case when v > 0 then case when b.dir > 0 then 8 else 188 end end,
      v
    );
  end loop;
end;
$$;

revoke execute on function public.on_water_sim_tick() from public, anon, authenticated;

-- Ends every simulated outing in a club.
create or replace function public.on_water_sim_stop(p_club_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_global_admin() then
    raise exception 'Only global admins can run the boat simulator.';
  end if;
  update on_water_sessions set ended_at = now()
  where ended_at is null and id in (select session_id from on_water_sim_boats where club_id = p_club_id);
  delete from on_water_sim_boats where club_id = p_club_id;
  if not exists (select 1 from on_water_sim_boats) then
    perform cron.unschedule(jobid) from cron.job where jobname = 'on-water-sim';
  end if;
end;
$$;

-- Puts up to p_boats pretend boats on the water for p_minutes, one per
-- coxswain who isn't already out. Returns how many went out.
create or replace function public.on_water_sim_start(p_club_id uuid, p_boats int, p_minutes int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  palette text[] := array[
    '#dc2626', '#2563eb', '#16a34a', '#ea580c', '#9333ea',
    '#db2777', '#0d9488', '#ca8a04', '#92400e', '#111827'
  ];
  free_colors text[];
  cox record;
  v_boat uuid;
  new_id uuid;
  n int := 0;
begin
  if not public.is_global_admin() then
    raise exception 'Only global admins can run the boat simulator.';
  end if;
  p_boats := least(greatest(coalesce(p_boats, 5), 1), 10);
  p_minutes := least(greatest(coalesce(p_minutes, 30), 1), 180);

  perform public.on_water_sim_stop(p_club_id);

  select coalesce(array_agg(c), '{}') into free_colors
  from unnest(palette) c
  where c not in (select color from on_water_sessions where ended_at is null and color is not null);

  for cox in
    select p.id from profiles p
    where p.club_id = p_club_id and p.role = 'coxswain' and p.disabled_at is null
      and not exists (select 1 from on_water_sessions s where s.coxswain_id = p.id and s.ended_at is null)
    order by random()
    limit p_boats
  loop
    select b.id into v_boat from boats b
    where b.club_id = p_club_id
      and not exists (select 1 from on_water_sessions s where s.boat_id = b.id and s.ended_at is null)
    order by random()
    limit 1;

    insert into on_water_sessions (coxswain_id, boat_id, club_id, color, started_at)
    values (cox.id, v_boat, p_club_id, free_colors[n + 1], now() - interval '20 minutes')
    returning id into new_id;

    insert into on_water_sim_boats (session_id, club_id, lane, split_s, pos, dir, rest_s, ends_at)
    values (
      new_id,
      p_club_id,
      0.3 + random() * 0.4,
      105 + random() * 30,
      0.1 + random() * 0.8,
      case when random() < 0.5 then 1 else -1 end,
      case when random() < 0.25 then 40 else 0 end,
      now() + make_interval(mins => p_minutes)
    );
    n := n + 1;
  end loop;

  if n = 0 then
    raise exception 'No coxswains in this club are free to go out.';
  end if;

  if not exists (select 1 from cron.job where jobname = 'on-water-sim') then
    perform cron.schedule('on-water-sim', '3 seconds', 'select public.on_water_sim_tick()');
  end if;
  return n;
end;
$$;

-- When the simulator's boats come in, for the console.
create or replace function public.on_water_sim_status(p_club_id uuid)
returns table (boats int, ends_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int, max(s.ends_at)
  from on_water_sim_boats s
  where s.club_id = p_club_id and public.is_global_admin();
$$;

revoke execute on function public.on_water_sim_stop(uuid) from public, anon;
revoke execute on function public.on_water_sim_start(uuid, int, int) from public, anon;
revoke execute on function public.on_water_sim_status(uuid) from public, anon;
grant execute on function public.on_water_sim_stop(uuid) to authenticated;
grant execute on function public.on_water_sim_start(uuid, int, int) to authenticated;
grant execute on function public.on_water_sim_status(uuid) to authenticated;
