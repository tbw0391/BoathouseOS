-- In-app messaging: fix missing RLS policies (nobody could actually create a
-- chat group before this), avoid RLS self-reference recursion, add a
-- persistent group chat per team that people are auto-joined to based on
-- their profile_teams membership, and turn on realtime for messages.

-- ---------- fix chat_group_members recursion ----------
-- The existing select policy subqueries chat_group_members from within its
-- own policy, which triggers "infinite recursion detected in policy for
-- relation chat_group_members" once it's actually exercised. Route the check
-- through a security-definer function instead, which evaluates outside RLS.
create or replace function is_chat_group_member(gid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from chat_group_members where group_id = gid and user_id = auth.uid()
  );
$$;

drop policy if exists "members can read their own memberships" on chat_group_members;
create policy "members can read their own memberships"
  on chat_group_members for select
  to authenticated
  using (auth.uid() = user_id or is_chat_group_member(group_id));

drop policy if exists "group members can read their groups" on chat_groups;
create policy "group members can read their groups"
  on chat_groups for select
  to authenticated
  using (is_chat_group_member(id));

drop policy if exists "group members can read messages" on messages;
create policy "group members can read messages"
  on messages for select
  to authenticated
  using (is_chat_group_member(group_id));

drop policy if exists "group members can send messages" on messages;
create policy "group members can send messages"
  on messages for insert
  to authenticated
  with check (auth.uid() = sender_id and is_chat_group_member(group_id));

-- ---------- missing insert policies ----------
-- Anyone can create a chat group (they become its creator/first member).
create policy "authenticated users can create chat groups"
  on chat_groups for insert
  to authenticated
  with check (created_by = auth.uid());

-- The creator (or an existing member) can add other people when starting or
-- growing a group chat; "members can manage their own membership row"
-- already covers adding/updating your own row.
create policy "creator or member can add others to a group"
  on chat_group_members for insert
  to authenticated
  with check (
    is_chat_group_member(group_id)
    or exists (select 1 from chat_groups g where g.id = group_id and g.created_by = auth.uid())
  );

create index if not exists messages_group_created_idx on messages (group_id, created_at);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table messages;
  end if;
end $$;

-- ---------- one persistent group chat per team ----------
alter table chat_groups add column if not exists team team unique;

insert into chat_groups (name, is_direct, team)
values
  ('Men''s', false, 'mens'),
  ('Women''s', false, 'womens'),
  ('Development', false, 'development'),
  ('Masters', false, 'masters'),
  ('Alumni', false, 'alumni'),
  ('Parent', false, 'parent'),
  ('Coach', false, 'coach')
on conflict (team) do nothing;

insert into chat_group_members (group_id, user_id)
select cg.id, pt.profile_id
from profile_teams pt
join chat_groups cg on cg.team = pt.team
on conflict do nothing;

-- Keep team group membership in sync with profile_teams going forward,
-- regardless of what code path changes it (self-edit, admin add, import).
create or replace function sync_team_chat_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_group_id uuid;
begin
  if TG_OP = 'INSERT' then
    select id into target_group_id from chat_groups where team = NEW.team;
    if target_group_id is not null then
      insert into chat_group_members (group_id, user_id)
      values (target_group_id, NEW.profile_id)
      on conflict do nothing;
    end if;
    return NEW;
  elsif TG_OP = 'DELETE' then
    select id into target_group_id from chat_groups where team = OLD.team;
    if target_group_id is not null then
      delete from chat_group_members
      where group_id = target_group_id and user_id = OLD.profile_id;
    end if;
    return OLD;
  end if;
  return null;
end;
$$;

drop trigger if exists profile_teams_sync_chat on profile_teams;
create trigger profile_teams_sync_chat
  after insert or delete on profile_teams
  for each row execute function sync_team_chat_membership();
