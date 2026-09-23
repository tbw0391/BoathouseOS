-- A race is often added to the schedule before it's assigned a boat/lineup
-- (see the `races` table / "Races needing a lineup"), but a coach still
-- wants to start lining up who's doing Launch/Recovery for it. `race_id`
-- lets a coach_tasks row point at just the race (lineup_id null) until a
-- boat is assigned — createLineupForRace then re-points that same row at
-- the new lineup instead of creating a duplicate pair.

alter table coach_tasks add column race_id uuid references races (id) on delete cascade;

create unique index coach_tasks_race_task_type_idx
  on coach_tasks (race_id, task_type_id)
  where race_id is not null;

create index coach_tasks_race_id_idx on coach_tasks (race_id);

-- Backfill: every race that doesn't have a boat yet gets its Launch/Recovery
-- pair too (races that already have a lineup got theirs from 0055's
-- lineup-based backfill).
insert into coach_tasks (event_id, task_type_id, race_id, created_by)
select r.event_id, tt.id, r.id, r.created_by
from races r
cross join task_types tt
where tt.name in ('Launch', 'Recovery')
  and r.lineup_id is null
on conflict (race_id, task_type_id) where race_id is not null do nothing;
