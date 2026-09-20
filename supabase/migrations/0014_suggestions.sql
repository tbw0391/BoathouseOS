-- A simple suggestion box: anyone can submit an idea, coaches/admins review
-- them and decide what makes it onto the backlog.

create table if not exists suggestions (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid references profiles (id) on delete set null,
  body text not null,
  status text not null default 'new' check (status in ('new', 'reviewed')),
  created_at timestamptz not null default now()
);

alter table suggestions enable row level security;

create policy "people can submit suggestions"
  on suggestions for insert
  to authenticated
  with check (submitted_by = auth.uid());

create policy "people can read their own suggestions"
  on suggestions for select
  to authenticated
  using (submitted_by = auth.uid());

create policy "staff can read all suggestions"
  on suggestions for select
  to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')));

create policy "staff can update suggestions"
  on suggestions for update
  to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')));

create policy "staff can delete suggestions"
  on suggestions for delete
  to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')));
