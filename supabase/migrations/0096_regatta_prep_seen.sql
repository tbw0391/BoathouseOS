-- The home page's "<regatta> is coming up — get ready" buttons go away once
-- they've been followed: which of Food Tent, Volunteer and Lineups each
-- person has opened for each regatta. Written by the pages themselves when
-- they load. Each person only sees and writes their own rows. Safe to re-run.

create table if not exists regatta_prep_seen (
  user_id uuid not null references profiles (id) on delete cascade,
  event_id uuid not null references schedule_events (id) on delete cascade,
  item text not null check (item in ('food_tent', 'volunteer', 'lineups')),
  seen_at timestamptz not null default now(),
  primary key (user_id, event_id, item)
);

create index if not exists regatta_prep_seen_event_idx on regatta_prep_seen (event_id);

alter table regatta_prep_seen enable row level security;

drop policy if exists "members see what they've opened" on regatta_prep_seen;
create policy "members see what they've opened"
  on regatta_prep_seen for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "members record what they've opened" on regatta_prep_seen;
create policy "members record what they've opened"
  on regatta_prep_seen for insert
  to authenticated
  with check (user_id = auth.uid());

select public.apply_approval_gate();
