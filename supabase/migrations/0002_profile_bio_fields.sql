-- Bio fields for each roster member, plus a public avatars bucket for photos.

alter table profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists address text,
  add column if not exists high_school text,
  add column if not exists grad_year int,
  add column if not exists fun_fact text,
  add column if not exists photo_url text,
  add column if not exists birthday date;

-- Coaches/admins can edit any bio, not just their own.
create policy "coaches and admins update any profile"
  on profiles for update
  to authenticated
  using (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')
  ))
  with check (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')
  ));

-- Avatars storage bucket: public read, owner (or coach/admin) can write to
-- a folder named after the profile id, e.g. `<profile_id>/photo.jpg`.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatar owner or staff can upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')
      )
    )
  );

create policy "avatar owner or staff can update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')
      )
    )
  );

create policy "avatar owner or staff can delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')
      )
    )
  );
