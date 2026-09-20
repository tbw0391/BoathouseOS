-- Team photo gallery: anyone can post a photo, optionally tagging roster
-- members. A tagged member sees the photo on their own bio page.

create table photos (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  caption text,
  uploaded_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

alter table photos enable row level security;

create policy "photos are readable by authenticated users"
  on photos for select
  to authenticated
  using (true);

create policy "authenticated users can add a photo"
  on photos for insert
  to authenticated
  with check (auth.uid() = uploaded_by);

create policy "uploader or staff can delete a photo"
  on photos for delete
  to authenticated
  using (
    auth.uid() = uploaded_by
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'coach'))
  );

create table photo_tags (
  photo_id uuid not null references photos (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  tagged_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  primary key (photo_id, profile_id)
);

alter table photo_tags enable row level security;

create policy "photo tags are readable by authenticated users"
  on photo_tags for select
  to authenticated
  using (true);

create policy "authenticated users can tag people in a photo"
  on photo_tags for insert
  to authenticated
  with check (auth.uid() is not null);

create policy "tagger, tagged member, uploader, or staff can remove a tag"
  on photo_tags for delete
  to authenticated
  using (
    auth.uid() = tagged_by
    or auth.uid() = profile_id
    or exists (select 1 from photos ph where ph.id = photo_tags.photo_id and ph.uploaded_by = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'coach'))
  );

-- Photos storage bucket: public read, any authenticated user can upload.
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

create policy "authenticated users can upload a photo"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'photos');

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
