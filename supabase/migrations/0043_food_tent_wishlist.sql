-- Food tent wish list: standing equipment/supply asks (cooler, tent fan,
-- serving gear, ...) that aren't tied to a single regatta day, distinct from
-- the per-event food donation sign-up sheet in 0007_food_tent.sql. Mirrors
-- food_tent_items/food_tent_signups minus the event_id tie.

create table food_tent_wishlist_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  quantity_needed int not null default 1,
  notes text,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table food_tent_wishlist_items enable row level security;

create policy "food tent wishlist items are readable by authenticated users"
  on food_tent_wishlist_items for select
  to authenticated
  using (true);

create policy "admins, coaches, and tent leaders manage food tent wishlist items"
  on food_tent_wishlist_items for all
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

create table food_tent_wishlist_signups (
  item_id uuid not null references food_tent_wishlist_items (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  quantity int not null default 1,
  signed_up_at timestamptz not null default now(),
  primary key (item_id, user_id)
);

alter table food_tent_wishlist_signups enable row level security;

create policy "food tent wishlist signups are readable by authenticated users"
  on food_tent_wishlist_signups for select
  to authenticated
  using (true);

create policy "users manage their own food tent wishlist signup"
  on food_tent_wishlist_signups for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "admins, coaches, and tent leaders manage any food tent wishlist signup"
  on food_tent_wishlist_signups for all
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
