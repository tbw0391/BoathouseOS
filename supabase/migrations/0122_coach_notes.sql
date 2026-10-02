-- Coach notes (2026-10-01, from suggestions): notes only coaches and admins
-- see. A note is about one athlete (athlete_id), or a practice day's shared
-- notes (note_date), which every coach sees live as they're added.

create table if not exists public.coach_notes (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null default public.default_club_id() references public.clubs (id),
  athlete_id uuid references public.profiles (id) on delete cascade,
  note_date date,
  body text not null check (char_length(body) between 1 and 4000),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (athlete_id is not null or note_date is not null)
);

create index if not exists coach_notes_club_id_idx on public.coach_notes (club_id);
create index if not exists coach_notes_athlete_idx on public.coach_notes (athlete_id) where athlete_id is not null;
create index if not exists coach_notes_date_idx on public.coach_notes (note_date) where note_date is not null;
create index if not exists coach_notes_created_by_idx on public.coach_notes (created_by);

alter table public.coach_notes enable row level security;

drop policy if exists "coaches and admins read coach notes" on public.coach_notes;
create policy "coaches and admins read coach notes"
  on public.coach_notes for select
  to authenticated
  using ((select public.is_coach_or_admin()));

drop policy if exists "coaches and admins add coach notes" on public.coach_notes;
create policy "coaches and admins add coach notes"
  on public.coach_notes for insert
  to authenticated
  with check ((select public.is_coach_or_admin()) and created_by = (select auth.uid()));

-- Each coach deletes their own notes; admins can delete any.
drop policy if exists "authors and admins delete coach notes" on public.coach_notes;
create policy "authors and admins delete coach notes"
  on public.coach_notes for delete
  to authenticated
  using (
    (select public.is_coach_or_admin())
    and (created_by = (select auth.uid()) or (select public.is_club_admin()))
  );

-- Practice notes show up on every coach's screen as they're added.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'coach_notes'
  ) then
    alter publication supabase_realtime add table public.coach_notes;
  end if;
end $$;

select public.apply_club_isolation();
select public.apply_approval_gate();
