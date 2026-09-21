-- Repairs storage RLS for the avatars/photos buckets. Both buckets exist
-- live, but their insert/update/delete policies on storage.objects do not
-- (confirmed by direct testing: a real authenticated user's own-avatar
-- upload, and a plain photo-gallery upload, both fail with "new row
-- violates row-level security policy" even though 0002_profile_bio_fields.sql
-- and 0009_photos.sql define the policies below). This re-applies them
-- idempotently so it's safe to run regardless of the current live state.

drop policy if exists "avatar owner or staff can upload" on storage.objects;
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

drop policy if exists "avatar owner or staff can update" on storage.objects;
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

drop policy if exists "avatar owner or staff can delete" on storage.objects;
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

drop policy if exists "authenticated users can upload a photo" on storage.objects;
create policy "authenticated users can upload a photo"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'photos');

drop policy if exists "uploader or staff can delete a photo object" on storage.objects;
create policy "uploader or staff can delete a photo object"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')
      )
    )
  );
