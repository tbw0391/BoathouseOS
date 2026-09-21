-- Polls: admins, coaches, and board members create a question with options
-- (single- or multiple-choice, set per poll). Any member can vote, and votes
-- are visible by name, matching the rest of the app's transparency (e.g.
-- food tent signups).

create table polls (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  allow_multiple boolean not null default false,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

alter table polls enable row level security;

create policy "polls are readable by authenticated users"
  on polls for select
  to authenticated
  using (true);

create policy "admins, coaches, and board members manage polls"
  on polls for all
  to authenticated
  using (exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and (p.role in ('admin', 'coach') or p.is_board_member)
  ))
  with check (exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and (p.role in ('admin', 'coach') or p.is_board_member)
  ));

create table poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references polls (id) on delete cascade,
  label text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

alter table poll_options enable row level security;

create policy "poll options are readable by authenticated users"
  on poll_options for select
  to authenticated
  using (true);

create policy "admins, coaches, and board members manage poll options"
  on poll_options for all
  to authenticated
  using (exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and (p.role in ('admin', 'coach') or p.is_board_member)
  ))
  with check (exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and (p.role in ('admin', 'coach') or p.is_board_member)
  ));

create table poll_votes (
  poll_id uuid not null references polls (id) on delete cascade,
  option_id uuid not null references poll_options (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  voted_at timestamptz not null default now(),
  primary key (poll_id, option_id, user_id)
);

alter table poll_votes enable row level security;

create policy "poll votes are readable by authenticated users"
  on poll_votes for select
  to authenticated
  using (true);

create policy "users manage their own poll vote"
  on poll_votes for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "admins, coaches, and board members manage any poll vote"
  on poll_votes for all
  to authenticated
  using (exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and (p.role in ('admin', 'coach') or p.is_board_member)
  ))
  with check (exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and (p.role in ('admin', 'coach') or p.is_board_member)
  ));
