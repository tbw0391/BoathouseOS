-- When each person last opened the Food Tent page, so the home page's food
-- tent message banners (0118) go away once they've tapped through: a banner
-- shows only if its message was posted after their last visit. Safe to
-- re-run.

create table if not exists food_tent_seen (
  user_id uuid primary key references profiles (id) on delete cascade,
  seen_at timestamptz not null default now()
);

alter table food_tent_seen enable row level security;

drop policy if exists "members see when they opened the food tent" on food_tent_seen;
create policy "members see when they opened the food tent"
  on food_tent_seen for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "members record opening the food tent" on food_tent_seen;
create policy "members record opening the food tent"
  on food_tent_seen for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "members update when they opened the food tent" on food_tent_seen;
create policy "members update when they opened the food tent"
  on food_tent_seen for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

select public.apply_approval_gate();
