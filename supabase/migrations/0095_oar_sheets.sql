-- Oar sheets: for each regatta boat, which oar goes in each seat, picked by
-- the boat's cox (or the stroke seat in boats without one). Oars are named by
-- their tape: a color and a number of rings ("3 Green"); the club's colors
-- live in club_settings "oar_colors". The same person also picks who does
-- Launch and Recovery for the boat (the coach_tasks auto-created per lineup
-- in 0055). Safe to re-run.

create table if not exists lineup_oars (
  lineup_id uuid not null references lineups (id) on delete cascade,
  seat_number integer not null check (seat_number between 1 and 20),
  tape_color text not null check (length(tape_color) between 1 and 30),
  rings integer not null check (rings between 1 and 20),
  updated_by uuid references profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (lineup_id, seat_number)
);

alter table lineup_oars enable row level security;

-- The person who fills in a boat's oar sheet: whoever is in its cox seat,
-- or, if it has no cox seat, the highest-numbered (stroke) rower seat.
create or replace function public.is_lineup_captain(lineup uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_approved() and exists (
    select 1 from lineup_seats s
    where s.lineup_id = lineup
      and s.rower_id = auth.uid()
      and (
        s.seat_role = 'coxswain'
        or (
          s.seat_role = 'rower'
          and not exists (select 1 from lineup_seats c where c.lineup_id = lineup and c.seat_role = 'coxswain')
          and s.seat_number = (select max(r.seat_number) from lineup_seats r where r.lineup_id = lineup and r.seat_role = 'rower')
        )
      )
  );
$$;

revoke execute on function public.is_lineup_captain(uuid) from public, anon;
grant execute on function public.is_lineup_captain(uuid) to authenticated;

drop policy if exists "members see oar sheets" on lineup_oars;
create policy "members see oar sheets"
  on lineup_oars for select
  to authenticated
  using (true);

drop policy if exists "captains, coaches and admins fill in oar sheets" on lineup_oars;
create policy "captains, coaches and admins fill in oar sheets"
  on lineup_oars for all
  to authenticated
  using (
    public.is_lineup_captain(lineup_id)
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin'))
  )
  with check (
    public.is_lineup_captain(lineup_id)
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin'))
  );

-- A boat's captain can add and remove people on that boat's Launch and
-- Recovery tasks (coaches and admins already can, from 0054).
drop policy if exists "captains assign their boat's launch and recovery" on coach_task_assignments;
create policy "captains assign their boat's launch and recovery"
  on coach_task_assignments for all
  to authenticated
  using (exists (
    select 1 from coach_tasks t
    where t.id = coach_task_assignments.task_id
      and t.lineup_id is not null
      and public.is_lineup_captain(t.lineup_id)
  ))
  with check (exists (
    select 1 from coach_tasks t
    where t.id = coach_task_assignments.task_id
      and t.lineup_id is not null
      and public.is_lineup_captain(t.lineup_id)
  ));

select public.apply_approval_gate();
