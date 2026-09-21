-- Seeing/managing all suggestions is now admin-only (previously coaches
-- could too). Anyone can still submit a suggestion and read their own.
drop policy if exists "staff can read all suggestions" on suggestions;
drop policy if exists "staff can update suggestions" on suggestions;
drop policy if exists "staff can delete suggestions" on suggestions;

create policy "admins can read all suggestions"
  on suggestions for select
  to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "admins can update suggestions"
  on suggestions for update
  to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "admins can delete suggestions"
  on suggestions for delete
  to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
