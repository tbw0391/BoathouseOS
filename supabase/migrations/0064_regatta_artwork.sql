-- Regatta artwork: a coach/admin can upload a regatta's logo, and every medal
-- a rower wins there (their lineup placed 1st-3rd) shows it on their bio,
-- inside a gold/silver/bronze badge. Regattas without artwork still get the
-- badge, just with the place in the middle instead of a logo.

alter table schedule_events add column artwork_url text;

-- Public read like avatars/photos; images only, no SVG (it can carry script).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'regatta-artwork',
  'regatta-artwork',
  true,
  5 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

create policy "coaches and admins upload regatta artwork"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'regatta-artwork'
    and exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin'))
  );

create policy "coaches and admins delete regatta artwork"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'regatta-artwork'
    and exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin'))
  );
