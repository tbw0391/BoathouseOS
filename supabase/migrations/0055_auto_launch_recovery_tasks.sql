-- Auto-create a Launch and Recovery coach task for every boat (lineup)
-- assigned to a race, instead of a coach having to add them by hand each
-- time. `lineup_id` links a task back to the specific boat it's for; the
-- partial unique index stops the same boat from getting two Launch tasks
-- if lineup creation is ever retried.

alter table coach_tasks add column lineup_id uuid references lineups (id) on delete cascade;

create unique index coach_tasks_lineup_task_type_idx
  on coach_tasks (lineup_id, task_type_id)
  where lineup_id is not null;

create index coach_tasks_lineup_id_idx on coach_tasks (lineup_id);

-- Backfill: every lineup that already exists gets its Launch/Recovery pair too.
insert into coach_tasks (event_id, task_type_id, lineup_id, created_by)
select l.event_id, tt.id, l.id, l.created_by
from lineups l
cross join task_types tt
where tt.name in ('Launch', 'Recovery')
on conflict (lineup_id, task_type_id) where lineup_id is not null do nothing;
