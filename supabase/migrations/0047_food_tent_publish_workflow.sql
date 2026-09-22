-- Food tent publish workflow: lets the regatta-prep automation (0049) drop
-- in a draft copy of the last regatta's food list without showing it to
-- parents yet. `published` defaults to true so every item added the normal,
-- manual way (today's only path) behaves exactly as before; only the
-- automation ever inserts a false row.
alter table food_tent_items
  add column if not exists published boolean not null default true;

-- Per-regatta status for that draft: draft (unused today, reserved) ->
-- pending_confirmation (auto-generated, waiting on the tent leader) ->
-- published (tent leader reviewed/edited and published it to parents).
create table if not exists food_tent_status (
  event_id uuid primary key references schedule_events (id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'pending_confirmation', 'published')),
  draft_generated_at timestamptz,
  confirmed_by uuid references profiles (id) on delete set null,
  confirmed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

alter table food_tent_status enable row level security;

create policy "food tent status is readable by authenticated users"
  on food_tent_status for select
  to authenticated
  using (true);

create policy "admins, coaches, and tent leaders manage food tent status"
  on food_tent_status for all
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

-- Unpublished (draft) items are only visible to the people who can act on
-- them — everyone else's `select *` simply won't include them until published.
drop policy if exists "food tent items are readable by authenticated users" on food_tent_items;

create policy "food tent items are readable when published or by managers"
  on food_tent_items for select
  to authenticated
  using (
    published
    or exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and (p.role in ('admin', 'coach') or p.is_tent_leader)
    )
  );
