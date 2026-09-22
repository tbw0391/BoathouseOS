-- Coach broadcast messages: a one-way announcement (not a chat) a coach or
-- admin sends to all rowers, all parents, or both, independent of team.
-- Shows as a home-page banner to the matching audience (see app/page.tsx)
-- and lives in /announcements for compose + history.

create table if not exists coach_announcements (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references profiles (id) on delete set null,
  audience text not null check (audience in ('rowers', 'parents', 'both')),
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists coach_announcements_created_idx on coach_announcements (created_at desc);

alter table coach_announcements enable row level security;

create policy "staff can send announcements"
  on coach_announcements for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin'))
  );

create policy "rowers can read rower announcements"
  on coach_announcements for select
  to authenticated
  using (
    audience in ('rowers', 'both')
    and exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('rower', 'coxswain'))
  );

create policy "parents can read parent announcements"
  on coach_announcements for select
  to authenticated
  using (
    audience in ('parents', 'both')
    and exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'parent')
  );

create policy "staff can read all announcements"
  on coach_announcements for select
  to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')));

create policy "staff can delete announcements"
  on coach_announcements for delete
  to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')));
