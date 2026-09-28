-- Trailer loading list per regatta (Trailer tab on the regatta's page).
-- Coaches and admins build the list; anyone in the club can tick items off
-- as packed for the trip there and packed for the trip home, through
-- set_trailer_item_packed() so they can't change anything else. Safe to
-- re-run.

create table if not exists trailer_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references schedule_events (id) on delete cascade,
  label text not null check (length(label) between 1 and 80),
  kind text not null default 'other' check (kind in ('boat', 'oars', 'rigging', 'electronics', 'other')),
  boat_id uuid references boats (id) on delete set null,
  sort integer not null default 0,
  packed_out_at timestamptz,
  packed_out_by uuid references profiles (id) on delete set null,
  packed_home_at timestamptz,
  packed_home_by uuid references profiles (id) on delete set null,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists trailer_items_event_idx on trailer_items (event_id);

alter table trailer_items enable row level security;

drop policy if exists "members see trailer lists" on trailer_items;
create policy "members see trailer lists"
  on trailer_items for select
  to authenticated
  using (true);

drop policy if exists "coaches and admins manage trailer lists" on trailer_items;
create policy "coaches and admins manage trailer lists"
  on trailer_items for all
  to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')));

-- Tick or untick one item. leg: 'out' (to the regatta) or 'home'.
create or replace function public.set_trailer_item_packed(item_id uuid, leg text, packed boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_approved() then
    raise exception 'Only club members can update the trailer list.';
  end if;
  if leg = 'out' then
    update trailer_items
      set packed_out_at = case when packed then now() end,
          packed_out_by = case when packed then auth.uid() end
      where id = item_id;
  elsif leg = 'home' then
    update trailer_items
      set packed_home_at = case when packed then now() end,
          packed_home_by = case when packed then auth.uid() end
      where id = item_id;
  else
    raise exception 'Unknown leg.';
  end if;
end;
$$;

revoke execute on function public.set_trailer_item_packed(uuid, text, boolean) from public, anon;
grant execute on function public.set_trailer_item_packed(uuid, text, boolean) to authenticated;

select public.apply_approval_gate();
