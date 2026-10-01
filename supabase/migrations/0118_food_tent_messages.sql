-- Food tent (Todd, 2026-10-01):
-- - schedule_events.has_food_tent: off for a regatta with no food tent. Then
--   the 7-days-out job doesn't draft a food list for it, and the app skips
--   its food alerts, banners and reminders (including "2 gal of water").
--   Tent leaders change it through a server action (they can't edit the
--   schedule otherwise).
-- - food_tent_messages: banner messages from tent leaders, coaches and
--   admins, to families (parents and guardians) or everyone, optionally
--   about one regatta. Shown on the home page; members of the club read
--   them, managers post and delete.
--
-- Safe to re-run.

alter table public.schedule_events add column if not exists has_food_tent boolean not null default true;

create table if not exists public.food_tent_messages (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null default public.default_club_id() references public.clubs (id),
  sender_id uuid references public.profiles (id) on delete set null,
  event_id uuid references public.schedule_events (id) on delete cascade,
  audience text not null default 'families' check (audience in ('families', 'everyone')),
  message text not null check (length(trim(message)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists food_tent_messages_club_id_idx on public.food_tent_messages (club_id, created_at desc);
create index if not exists food_tent_messages_event_id_idx on public.food_tent_messages (event_id);
create index if not exists food_tent_messages_sender_id_idx on public.food_tent_messages (sender_id);

create or replace function public.is_food_tent_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and approved_at is not null and disabled_at is null
      and (role in ('admin', 'coach') or is_tent_leader)
  );
$$;

revoke execute on function public.is_food_tent_manager() from public, anon;
grant execute on function public.is_food_tent_manager() to authenticated;

alter table public.food_tent_messages enable row level security;

drop policy if exists "members read food tent messages" on public.food_tent_messages;
create policy "members read food tent messages"
  on public.food_tent_messages for select to authenticated using (true);

drop policy if exists "managers post food tent messages" on public.food_tent_messages;
create policy "managers post food tent messages"
  on public.food_tent_messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and (select public.is_food_tent_manager()));

drop policy if exists "managers delete food tent messages" on public.food_tent_messages;
create policy "managers delete food tent messages"
  on public.food_tent_messages for delete to authenticated
  using ((select public.is_food_tent_manager()));

select public.apply_approval_gate();
select public.apply_club_isolation();

-- Same as before, but skips regattas with no food tent.
create or replace function public.generate_regatta_prep()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  regatta record;
  prior_event_id uuid;
begin
  for regatta in
    select e.id, e.starts_at, e.club_id
    from schedule_events e
    where e.event_type = 'regatta'
      and e.has_food_tent
      and e.starts_at::date = (now()::date + interval '7 days')::date
      and not exists (select 1 from food_tent_status s where s.event_id = e.id)
      and not exists (select 1 from food_tent_items fi where fi.event_id = e.id)
  loop
    insert into food_tent_status (event_id, status, draft_generated_at, club_id)
    values (regatta.id, 'pending_confirmation', now(), regatta.club_id);
    select fi.event_id into prior_event_id
    from food_tent_items fi
    join schedule_events pe on pe.id = fi.event_id
    where pe.event_type = 'regatta'
      and pe.club_id = regatta.club_id
      and pe.starts_at < regatta.starts_at
    order by pe.starts_at desc
    limit 1;
    if prior_event_id is not null then
      insert into food_tent_items (event_id, title, quantity_needed, notes, published, club_id)
      select regatta.id, title, quantity_needed, notes, false, regatta.club_id
      from food_tent_items
      where event_id = prior_event_id;
    end if;
  end loop;
end;
$$;
