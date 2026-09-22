-- Give every boat lineup its own chat group, named after the boat, so its
-- crew can coordinate. Membership stays live as seats are assigned/
-- reassigned (mirrors the sync_team_chat_membership pattern from
-- 0011_messaging.sql) rather than being a one-time snapshot at creation.
-- Only rowers/coxswain actually seated are added — the coach who created
-- the lineup isn't auto-included unless they're also seated. What happens
-- to the chat when its lineup is deleted is still undecided, so deletion
-- is intentionally left untouched here.

alter table lineups
  add column if not exists chat_group_id uuid references chat_groups (id) on delete set null;

create or replace function create_lineup_chat()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_group_id uuid;
begin
  insert into chat_groups (name, is_direct, created_by)
  values (NEW.boat_name, false, NEW.created_by)
  returning id into new_group_id;

  NEW.chat_group_id := new_group_id;
  return NEW;
end;
$$;

drop trigger if exists lineups_create_chat on lineups;
create trigger lineups_create_chat
  before insert on lineups
  for each row execute function create_lineup_chat();

-- Adds a newly-assigned rower to the lineup's chat, and removes a
-- reassigned-away rower unless they still hold another seat in the same
-- lineup. A lineup_seats row is otherwise never deleted on its own (only
-- ever via its lineup being deleted, cascading), so a delete trigger isn't
-- needed here.
create or replace function sync_lineup_seat_chat_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_group_id uuid;
begin
  select chat_group_id into target_group_id
  from lineups where id = coalesce(NEW.lineup_id, OLD.lineup_id);

  if target_group_id is null then
    return NEW;
  end if;

  if TG_OP = 'INSERT' then
    if NEW.rower_id is not null then
      insert into chat_group_members (group_id, user_id)
      values (target_group_id, NEW.rower_id)
      on conflict do nothing;
    end if;
    return NEW;
  end if;

  if TG_OP = 'UPDATE' and NEW.rower_id is distinct from OLD.rower_id then
    if NEW.rower_id is not null then
      insert into chat_group_members (group_id, user_id)
      values (target_group_id, NEW.rower_id)
      on conflict do nothing;
    end if;

    if OLD.rower_id is not null and not exists (
      select 1 from lineup_seats
      where lineup_id = OLD.lineup_id and rower_id = OLD.rower_id and id <> OLD.id
    ) then
      delete from chat_group_members
      where group_id = target_group_id and user_id = OLD.rower_id;
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists lineup_seats_sync_chat on lineup_seats;
create trigger lineup_seats_sync_chat
  after insert or update on lineup_seats
  for each row execute function sync_lineup_seat_chat_membership();
