-- Private calendar feed per member (/api/calendar/<token>), so the club
-- schedule and their races show up in their phone's calendar app. The token
-- is the only thing protecting the feed, so it's long and random, and a
-- member can reset it. The feed route looks tokens up with the service key.
-- Safe to re-run.

create table if not exists calendar_feeds (
  profile_id uuid primary key references profiles (id) on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default now()
);

alter table calendar_feeds enable row level security;

drop policy if exists "members manage their own calendar feed" on calendar_feeds;
create policy "members manage their own calendar feed"
  on calendar_feeds for all
  to authenticated
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

select public.apply_approval_gate();
