-- Tracks when each person last looked at the schedule, so the home page can
-- show an unread indicator when a new event has been added since.

create table if not exists schedule_views (
  user_id uuid primary key references profiles (id) on delete cascade,
  last_viewed_at timestamptz not null default now()
);

alter table schedule_views enable row level security;

create policy "people manage their own schedule view"
  on schedule_views for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
