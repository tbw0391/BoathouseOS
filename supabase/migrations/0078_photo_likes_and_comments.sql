-- Likes and comments on team photos.

create table photo_likes (
  photo_id uuid not null references photos (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (photo_id, profile_id)
);

alter table photo_likes enable row level security;

create policy "photo likes are readable by authenticated users"
  on photo_likes for select
  to authenticated
  using (true);

create policy "members like as themselves"
  on photo_likes for insert
  to authenticated
  with check (auth.uid() = profile_id);

create policy "members unlike their own likes"
  on photo_likes for delete
  to authenticated
  using (auth.uid() = profile_id);

create table photo_comments (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references photos (id) on delete cascade,
  author_id uuid not null references profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index photo_comments_photo_idx on photo_comments (photo_id, created_at);

alter table photo_comments enable row level security;

create policy "photo comments are readable by authenticated users"
  on photo_comments for select
  to authenticated
  using (true);

create policy "members comment as themselves"
  on photo_comments for insert
  to authenticated
  with check (auth.uid() = author_id);

create policy "author or staff can delete a comment"
  on photo_comments for delete
  to authenticated
  using (
    auth.uid() = author_id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'coach'))
  );

select public.apply_approval_gate();
