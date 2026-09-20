-- Food tent: signup-genius-style item requests tied to a (usually regatta)
-- event. A tent leader is a member an admin designates who can manage item
-- requests for any event, without needing full admin/coach rights.

alter table profiles
  add column if not exists is_tent_leader boolean not null default false;

create table food_tent_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references schedule_events (id) on delete cascade,
  title text not null,
  quantity_needed int not null default 1,
  notes text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

alter table food_tent_items enable row level security;

create policy "food tent items are readable by authenticated users"
  on food_tent_items for select
  to authenticated
  using (true);

create policy "admins, coaches, and tent leaders manage food tent items"
  on food_tent_items for all
  to authenticated
  using (exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and (p.role in ('admin', 'coach') or p.is_tent_leader)
  ))
  with check (exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and (p.role in ('admin', 'coach') or p.is_tent_leader)
  ));

create table food_tent_signups (
  item_id uuid not null references food_tent_items (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  quantity int not null default 1,
  signed_up_at timestamptz not null default now(),
  primary key (item_id, user_id)
);

alter table food_tent_signups enable row level security;

create policy "food tent signups are readable by authenticated users"
  on food_tent_signups for select
  to authenticated
  using (true);

create policy "users manage their own food tent signup"
  on food_tent_signups for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "admins, coaches, and tent leaders manage any food tent signup"
  on food_tent_signups for all
  to authenticated
  using (exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and (p.role in ('admin', 'coach') or p.is_tent_leader)
  ))
  with check (exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and (p.role in ('admin', 'coach') or p.is_tent_leader)
  ));
