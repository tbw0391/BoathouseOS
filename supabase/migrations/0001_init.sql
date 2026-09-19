-- W-Crew-app initial schema: Westerville Rowing Club roster, schedule, lineups,
-- volunteer signups, and messaging.

-- Profiles ------------------------------------------------------------------

create type role as enum ('rower', 'coach', 'coxswain', 'parent', 'admin');

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text not null,
  role role not null default 'rower',
  phone text,
  boat_side text check (boat_side in ('port', 'starboard', 'either', null)),
  weight_lbs numeric,
  disabled_at timestamptz,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles are readable by authenticated users"
  on profiles for select
  to authenticated
  using (true);

create policy "users can update their own profile"
  on profiles for update
  to authenticated
  using (auth.uid() = id);

-- Schedule / events -----------------------------------------------------------

create table schedule_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  location text,
  event_type text not null default 'practice'
    check (event_type in ('practice', 'regatta', 'meeting', 'other')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  recurrence text not null default 'none'
    check (recurrence in ('none', 'weekly', 'monthly', 'yearly')),
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

alter table schedule_events enable row level security;

create policy "events are readable by authenticated users"
  on schedule_events for select
  to authenticated
  using (true);

create policy "coaches and admins manage events"
  on schedule_events for all
  to authenticated
  using (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')
  ))
  with check (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')
  ));

create table event_rsvps (
  event_id uuid not null references schedule_events (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'attending', 'not_attending')),
  responded_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table event_rsvps enable row level security;

create policy "rsvps are readable by authenticated users"
  on event_rsvps for select
  to authenticated
  using (true);

create policy "users manage their own rsvp"
  on event_rsvps for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Lineups ---------------------------------------------------------------------

create table lineups (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references schedule_events (id) on delete cascade,
  boat_name text not null,
  boat_class text not null,
  notes text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

alter table lineups enable row level security;

create policy "lineups are readable by authenticated users"
  on lineups for select
  to authenticated
  using (true);

create policy "coaches and admins manage lineups"
  on lineups for all
  to authenticated
  using (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')
  ))
  with check (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')
  ));

create table lineup_seats (
  id uuid primary key default gen_random_uuid(),
  lineup_id uuid not null references lineups (id) on delete cascade,
  seat_number int not null,
  seat_role text not null default 'rower'
    check (seat_role in ('rower', 'coxswain', 'coach')),
  rower_id uuid references profiles (id),
  unique (lineup_id, seat_number)
);

alter table lineup_seats enable row level security;

create policy "lineup seats are readable by authenticated users"
  on lineup_seats for select
  to authenticated
  using (true);

create policy "coaches and admins manage lineup seats"
  on lineup_seats for all
  to authenticated
  using (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')
  ))
  with check (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')
  ));

-- Volunteer needs ---------------------------------------------------------------

create table volunteer_needs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references schedule_events (id) on delete cascade,
  title text not null,
  description text,
  slots_needed int not null default 1,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

alter table volunteer_needs enable row level security;

create policy "volunteer needs are readable by authenticated users"
  on volunteer_needs for select
  to authenticated
  using (true);

create policy "coaches and admins manage volunteer needs"
  on volunteer_needs for all
  to authenticated
  using (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')
  ))
  with check (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')
  ));

create table volunteer_signups (
  need_id uuid not null references volunteer_needs (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  signed_up_at timestamptz not null default now(),
  primary key (need_id, user_id)
);

alter table volunteer_signups enable row level security;

create policy "volunteer signups are readable by authenticated users"
  on volunteer_signups for select
  to authenticated
  using (true);

create policy "users manage their own volunteer signup"
  on volunteer_signups for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Messaging -----------------------------------------------------------------

create table chat_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_direct boolean not null default false,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

alter table chat_groups enable row level security;

create table chat_group_members (
  group_id uuid not null references chat_groups (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

alter table chat_group_members enable row level security;

create policy "members can read their own memberships"
  on chat_group_members for select
  to authenticated
  using (auth.uid() = user_id or exists (
    select 1 from chat_group_members m where m.group_id = chat_group_members.group_id and m.user_id = auth.uid()
  ));

create policy "members can manage their own membership row"
  on chat_group_members for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "group members can read their groups"
  on chat_groups for select
  to authenticated
  using (exists (
    select 1 from chat_group_members m where m.group_id = chat_groups.id and m.user_id = auth.uid()
  ));

create table messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references chat_groups (id) on delete cascade,
  sender_id uuid not null references profiles (id),
  body text not null,
  created_at timestamptz not null default now()
);

alter table messages enable row level security;

create policy "group members can read messages"
  on messages for select
  to authenticated
  using (exists (
    select 1 from chat_group_members m where m.group_id = messages.group_id and m.user_id = auth.uid()
  ));

create policy "group members can send messages"
  on messages for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from chat_group_members m where m.group_id = messages.group_id and m.user_id = auth.uid()
    )
  );

-- Team store link + club settings -------------------------------------------

create table club_settings (
  key text primary key,
  value text
);

alter table club_settings enable row level security;

create policy "club settings are readable by authenticated users"
  on club_settings for select
  to authenticated
  using (true);

create policy "admins manage club settings"
  on club_settings for all
  to authenticated
  using (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  ))
  with check (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

insert into club_settings (key, value) values ('team_store_url', null);
