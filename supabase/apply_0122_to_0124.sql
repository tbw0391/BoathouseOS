-- Migrations 0122-0124 in one script to paste into the Supabase SQL editor
-- (Database > SQL Editor > New query > paste > Run), on the demo project
-- and then on BoathouseOS Production. Safe to run more than once, and on a
-- database where part of it already ran. It runs as one transaction, so it
-- either fully applies or changes nothing. Generated from the files in
-- supabase/migrations/, which stay the source of truth.
--
--   0122 message log (board-only copy of every chat message)
--   0123 SafeSport messaging (parents copied, no-message requests)
--   0124 graduates move to Alumni (daily job)

begin;

drop function if exists public.zz_test_fn();

-- ==================== 0122_message_log.sql ====================
-- Message log (SafeSport): a copy of every chat message that members can't
-- change or delete, readable only by their club's board members, for when a
-- concern needs looking into.
--
-- Each copy keeps the chat's name, who was in it, and the sender's name and
-- role as they were when it was sent, and has no foreign keys to messages,
-- chats or profiles, so deleting a message, a chat or a member leaves it in
-- place. A message deleted from the chat gets removed_at set here instead.
--
-- Every time a board member opens the log it's recorded in
-- message_log_views, which the whole board can see.

create or replace function public.is_board_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and is_board_member and approved_at is not null and disabled_at is null
  );
$$;

revoke execute on function public.is_board_member() from public, anon;
grant execute on function public.is_board_member() to authenticated;

create table if not exists public.message_log (
  message_id uuid primary key,
  club_id uuid not null references public.clubs (id) on delete cascade,
  group_id uuid not null,
  group_name text not null,
  is_direct boolean not null,
  sender_id uuid not null,
  sender_name text not null,
  sender_role text,
  member_ids uuid[] not null default '{}',
  member_names text[] not null default '{}',
  body text not null,
  sent_at timestamptz not null,
  removed_at timestamptz
);

create index if not exists message_log_club_sent_idx on public.message_log (club_id, sent_at desc);
create index if not exists message_log_group_idx on public.message_log (group_id, sent_at);
create index if not exists message_log_sender_idx on public.message_log (sender_id);
create index if not exists message_log_members_idx on public.message_log using gin (member_ids);

alter table public.message_log enable row level security;

-- Read-only, and only for board members. Nobody (signed in) can insert,
-- change or delete rows; the triggers below write them.
drop policy if exists "board members read the message log" on public.message_log;
create policy "board members read the message log"
  on public.message_log for select
  to authenticated
  using ((select public.is_board_member()));

revoke insert, update, delete, truncate on public.message_log from anon, authenticated;

create table if not exists public.message_log_views (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null default public.default_club_id() references public.clubs (id) on delete cascade,
  viewer_id uuid not null,
  viewer_name text not null,
  searched text not null default '',
  viewed_at timestamptz not null default now()
);

create index if not exists message_log_views_club_idx on public.message_log_views (club_id, viewed_at desc);

alter table public.message_log_views enable row level security;

drop policy if exists "board members see who opened the log" on public.message_log_views;
create policy "board members see who opened the log"
  on public.message_log_views for select
  to authenticated
  using ((select public.is_board_member()));

drop policy if exists "board members record opening the log" on public.message_log_views;
create policy "board members record opening the log"
  on public.message_log_views for insert
  to authenticated
  with check (viewer_id = auth.uid() and (select public.is_board_member()));

revoke update, delete, truncate on public.message_log_views from anon, authenticated;

-- Copies a new message, with the chat and its members as they are now.
create or replace function public.log_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into message_log (
    message_id, club_id, group_id, group_name, is_direct,
    sender_id, sender_name, sender_role, member_ids, member_names, body, sent_at
  )
  select
    new.id, new.club_id, new.group_id, coalesce(g.name, ''), coalesce(g.is_direct, false),
    new.sender_id, coalesce(s.display_name, 'Unknown'), s.role::text,
    coalesce(m.ids, '{}'), coalesce(m.names, '{}'), new.body, new.created_at
  from (select 1) one
  left join chat_groups g on g.id = new.group_id
  left join profiles s on s.id = new.sender_id
  left join lateral (
    select array_agg(p.id order by p.display_name) as ids,
           array_agg(p.display_name order by p.display_name) as names
    from chat_group_members cm
    join profiles p on p.id = cm.user_id
    where cm.group_id = new.group_id
  ) m on true
  on conflict (message_id) do nothing;
  return new;
end;
$$;

revoke execute on function public.log_chat_message() from public, anon, authenticated;

drop trigger if exists log_chat_message on public.messages;
create trigger log_chat_message
  after insert on public.messages
  for each row execute function public.log_chat_message();

-- A message deleted from the chat (by its sender, or with its chat or
-- member) stays in the log, marked removed.
create or replace function public.mark_chat_message_removed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update message_log set removed_at = now()
  where message_id = old.id and removed_at is null;
  return old;
end;
$$;

revoke execute on function public.mark_chat_message_removed() from public, anon, authenticated;

drop trigger if exists mark_chat_message_removed on public.messages;
create trigger mark_chat_message_removed
  after delete on public.messages
  for each row execute function public.mark_chat_message_removed();

-- Messages sent before today, with each chat's current members.
insert into public.message_log (
  message_id, club_id, group_id, group_name, is_direct,
  sender_id, sender_name, sender_role, member_ids, member_names, body, sent_at
)
select
  msg.id, msg.club_id, msg.group_id, coalesce(g.name, ''), coalesce(g.is_direct, false),
  msg.sender_id, coalesce(s.display_name, 'Unknown'), s.role::text,
  coalesce(m.ids, '{}'), coalesce(m.names, '{}'), msg.body, msg.created_at
from public.messages msg
left join public.chat_groups g on g.id = msg.group_id
left join public.profiles s on s.id = msg.sender_id
left join lateral (
  select array_agg(p.id order by p.display_name) as ids,
         array_agg(p.display_name order by p.display_name) as names
  from public.chat_group_members cm
  join public.profiles p on p.id = cm.user_id
  where cm.group_id = msg.group_id
) m on true
on conflict (message_id) do nothing;

select public.apply_club_isolation();
select public.apply_approval_gate();

-- ==================== 0123_safesport_messaging.sql ====================
-- SafeSport messaging (U.S. Center for SafeSport MAAPP 2025, Electronic
-- Communications). Every chat between an adult and a rower or coxswain
-- under 18 must copy the minor's parent/guardian or another adult, and a
-- parent can ask in writing that adults not message their child.
--
-- * Under 18: a rower or coxswain whose birthday says so, or who has no
--   birthday on file (same rule as text alerts).
-- * An adult in a chat with a minor "needs a parent copied" unless they're
--   that minor's guardian, or a fellow rower/cox no more than 4 years older
--   (the close-in-age exception: no authority over them).
-- * Whenever such a chat exists, the minor's guardians (family_links) are
--   added to it automatically, marked added_for_safesport. If a minor has
--   no guardian on the roster, the chat still passes with two or more
--   adults in it ("another Adult Participant"); otherwise nothing can be
--   sent in it until a parent is linked or another adult is added.
-- * No-message requests: the minor is taken out of any chat with an adult
--   who'd need a parent copied, and their guardians are put in instead, so
--   the family still gets team messages.
-- Checked when members join a chat, when a request is made, and before
-- every message is saved, so it holds however a chat was set up.

create or replace function public.safesport_minor(person uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = person
      and role in ('rower', 'coxswain')
      and (birthday is null or birthday > (current_date - interval '18 years'))
  );
$$;

create or replace function public.safesport_needs_copy(adult uuid, minor uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select adult <> minor
    and public.safesport_minor(minor)
    and not public.safesport_minor(adult)
    and not exists (select 1 from family_links where guardian_id = adult and rower_id = minor)
    and not exists (
      select 1 from profiles a, profiles m
      where a.id = adult and m.id = minor
        and a.role in ('rower', 'coxswain')
        and a.birthday is not null and m.birthday is not null
        and a.birthday >= m.birthday - interval '4 years'
    );
$$;

revoke execute on function public.safesport_minor(uuid) from public, anon;
revoke execute on function public.safesport_needs_copy(uuid, uuid) from public, anon;
grant execute on function public.safesport_minor(uuid) to authenticated;
grant execute on function public.safesport_needs_copy(uuid, uuid) to authenticated;

alter table public.chat_group_members
  add column if not exists added_for_safesport boolean not null default false;

-- A parent's written request that adults not message their child.
create table if not exists public.no_message_requests (
  rower_id uuid primary key references public.profiles (id) on delete cascade,
  club_id uuid not null default public.default_club_id() references public.clubs (id),
  requested_by uuid references public.profiles (id) on delete set null,
  requested_at timestamptz not null default now()
);

alter table public.no_message_requests enable row level security;

drop policy if exists "family, coaches and admins see no-message requests" on public.no_message_requests;
create policy "family, coaches and admins see no-message requests"
  on public.no_message_requests for select
  to authenticated
  using ((select public.can_act_for(rower_id)));

-- Only a guardian or an admin, never the rower themselves.
drop policy if exists "guardians and admins make no-message requests" on public.no_message_requests;
create policy "guardians and admins make no-message requests"
  on public.no_message_requests for insert
  to authenticated
  with check (
    requested_by = auth.uid()
    and (
      exists (select 1 from family_links where guardian_id = auth.uid() and rower_id = no_message_requests.rower_id)
      or (select public.is_club_admin())
    )
  );

drop policy if exists "guardians and admins withdraw no-message requests" on public.no_message_requests;
create policy "guardians and admins withdraw no-message requests"
  on public.no_message_requests for delete
  to authenticated
  using (
    exists (select 1 from family_links where guardian_id = auth.uid() and rower_id = no_message_requests.rower_id)
    or (select public.is_club_admin())
  );

-- Brings one chat in line: guardians in, requested minors out.
create or replace function public.enforce_chat_safesport(gid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  added integer;
  rounds integer := 0;
begin
  perform set_config('app.safesport_enforcing', 'on', true);

  -- Adding guardians can bring in adults who need other minors' guardians
  -- copied, so repeat until nothing changes.
  loop
    insert into chat_group_members (group_id, user_id, club_id, added_for_safesport)
    select distinct gid, f.guardian_id, g.club_id, true
    from chat_group_members m
    join family_links f on f.rower_id = m.user_id
    join profiles gp on gp.id = f.guardian_id and gp.disabled_at is null
    join chat_groups g on g.id = gid
    where m.group_id = gid
      and exists (
        select 1 from chat_group_members a
        where a.group_id = gid and public.safesport_needs_copy(a.user_id, m.user_id)
      )
    on conflict do nothing;
    get diagnostics added = row_count;
    rounds := rounds + 1;
    exit when added = 0 or rounds >= 5;
  end loop;

  -- Families who asked for no messages: guardians in (any minor's), the
  -- minor out, whenever an adult in the chat would need a parent copied.
  insert into chat_group_members (group_id, user_id, club_id, added_for_safesport)
  select distinct gid, f.guardian_id, g.club_id, true
  from chat_group_members m
  join no_message_requests r on r.rower_id = m.user_id
  join family_links f on f.rower_id = m.user_id
  join profiles gp on gp.id = f.guardian_id and gp.disabled_at is null
  join chat_groups g on g.id = gid
  where m.group_id = gid
    and exists (
      select 1 from chat_group_members a
      where a.group_id = gid and a.user_id <> f.guardian_id and public.safesport_needs_copy(a.user_id, m.user_id)
    )
  on conflict do nothing;

  delete from chat_group_members m
  using no_message_requests r
  where m.group_id = gid and r.rower_id = m.user_id
    and exists (
      select 1 from chat_group_members a
      where a.group_id = gid and public.safesport_needs_copy(a.user_id, m.user_id)
    );

  -- A one-on-one chat that now has parents in it is a group chat.
  update chat_groups set is_direct = false
  where id = gid and is_direct
    and (select count(*) from chat_group_members where group_id = gid) > 2;

  perform set_config('app.safesport_enforcing', 'off', true);
end;
$$;

revoke execute on function public.enforce_chat_safesport(uuid) from public, anon, authenticated;

-- Why a chat can't be used yet, or null when it's fine: a minor with an
-- adult who'd need a parent copied, no guardian of theirs in the chat, and
-- fewer than two adults in it.
create or replace function public.chat_safesport_problem(gid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select 'SafeSport: chats between adults and rowers under 18 must include a parent or another adult. '
    || p.display_name || ' has no parent or guardian linked on the roster, so add another coach or adult to this chat, or link a parent on their profile.'
  from chat_group_members m
  join profiles p on p.id = m.user_id
  where m.group_id = gid
    and exists (
      select 1 from chat_group_members a
      where a.group_id = gid and public.safesport_needs_copy(a.user_id, m.user_id)
    )
    and not exists (
      select 1 from chat_group_members gm
      join family_links f on f.guardian_id = gm.user_id and f.rower_id = m.user_id
      where gm.group_id = gid
    )
    and (
      select count(*) from chat_group_members x
      where x.group_id = gid and not public.safesport_minor(x.user_id)
    ) < 2
  order by p.display_name
  limit 1;
$$;

revoke execute on function public.chat_safesport_problem(uuid) from public, anon;
grant execute on function public.chat_safesport_problem(uuid) to authenticated;

-- After people join a chat (new chat, team, lineup, board).
create or replace function public.chat_member_safesport()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('app.safesport_enforcing', true) = 'on' then
    return null;
  end if;
  perform public.enforce_chat_safesport(new.group_id);
  return null;
end;
$$;

revoke execute on function public.chat_member_safesport() from public, anon, authenticated;

drop trigger if exists chat_member_safesport on public.chat_group_members;
create trigger chat_member_safesport
  after insert on public.chat_group_members
  for each row execute function public.chat_member_safesport();

-- When a rower leaves a chat, guardians who were only there for them go
-- too (unless their family asked for no messages: then the guardian is
-- there in the rower's place).
create or replace function public.chat_member_left_safesport()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('app.safesport_enforcing', true) = 'on' then
    return null;
  end if;
  delete from chat_group_members g
  where g.group_id = old.group_id
    and g.added_for_safesport
    and not exists (
      select 1 from family_links f
      join chat_group_members m on m.group_id = old.group_id and m.user_id = f.rower_id
      where f.guardian_id = g.user_id
    )
    and not exists (
      select 1 from family_links f
      join no_message_requests r on r.rower_id = f.rower_id
      where f.guardian_id = g.user_id
    );
  return null;
end;
$$;

revoke execute on function public.chat_member_left_safesport() from public, anon, authenticated;

drop trigger if exists chat_member_left_safesport on public.chat_group_members;
create trigger chat_member_left_safesport
  after delete on public.chat_group_members
  for each row execute function public.chat_member_left_safesport();

-- Before every message: bring the chat in line, then refuse if it still
-- isn't (the message says why).
create or replace function public.message_safesport()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  problem text;
begin
  perform public.enforce_chat_safesport(new.group_id);
  if not exists (select 1 from chat_group_members where group_id = new.group_id and user_id = new.sender_id)
     and exists (select 1 from no_message_requests where rower_id = new.sender_id) then
    raise exception 'SafeSport: your parent asked that adults not message you, so you''ve been taken out of this chat.';
  end if;
  problem := public.chat_safesport_problem(new.group_id);
  if problem is not null then
    raise exception '%', problem;
  end if;
  return new;
end;
$$;

revoke execute on function public.message_safesport() from public, anon, authenticated;

drop trigger if exists message_safesport on public.messages;
create trigger message_safesport
  before insert on public.messages
  for each row execute function public.message_safesport();

-- A new request applies to every chat the rower is in right away.
create or replace function public.no_message_request_applies()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  gid uuid;
begin
  for gid in select group_id from chat_group_members where user_id = new.rower_id loop
    perform public.enforce_chat_safesport(gid);
  end loop;
  return null;
end;
$$;

revoke execute on function public.no_message_request_applies() from public, anon, authenticated;

drop trigger if exists no_message_request_applies on public.no_message_requests;
create trigger no_message_request_applies
  after insert on public.no_message_requests
  for each row execute function public.no_message_request_applies();

-- Withdrawing a request puts the rower back in their team chats (other
-- chats they were taken out of can add them again).
create or replace function public.no_message_request_withdrawn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into chat_group_members (group_id, user_id, club_id)
  select g.id, old.rower_id, g.club_id
  from profile_teams t
  join chat_groups g on g.team = t.team and g.club_id = t.club_id
  where t.profile_id = old.rower_id
  on conflict do nothing;
  return null;
end;
$$;

revoke execute on function public.no_message_request_withdrawn() from public, anon, authenticated;

drop trigger if exists no_message_request_withdrawn on public.no_message_requests;
create trigger no_message_request_withdrawn
  after delete on public.no_message_requests
  for each row execute function public.no_message_request_withdrawn();

-- Existing chats.
do $$
declare
  gid uuid;
begin
  for gid in select id from public.chat_groups loop
    perform public.enforce_chat_safesport(gid);
  end loop;
end;
$$;

select public.apply_club_isolation();
select public.apply_approval_gate();

-- ==================== 0124_graduate_to_alumni.sql ====================
-- Rowers and coxswains move to Alumni once they graduate: on July 1 of
-- their grad year (after the spring season and youth nationals), they leave
-- the Men's, Women's and Development teams (and those team chats) and join
-- Alumni (and its chat), through the usual team-chat triggers.
--
-- Only people not already in Alumni are moved, so a coach can put an alum
-- back on a team by hand and they'll stay. Runs every morning.

create or replace function public.graduate_to_alumni()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  moved integer;
begin
  create temporary table graduates on commit drop as
  select p.id, p.club_id
  from profiles p
  where p.role in ('rower', 'coxswain')
    and p.grad_year is not null
    and p.disabled_at is null
    and make_date(p.grad_year, 7, 1) <= current_date
    and exists (
      select 1 from profile_teams t
      where t.profile_id = p.id and t.team in ('mens', 'womens', 'development')
    )
    and not exists (
      select 1 from profile_teams t
      where t.profile_id = p.id and t.team = 'alumni'
    );

  delete from profile_teams t
  using graduates g
  where t.profile_id = g.id and t.team in ('mens', 'womens', 'development');

  insert into profile_teams (profile_id, team, club_id)
  select id, 'alumni', club_id from graduates
  on conflict do nothing;

  select count(*) into moved from graduates;
  drop table graduates;
  return moved;
end;
$$;

revoke execute on function public.graduate_to_alumni() from public, anon, authenticated;

select cron.unschedule('graduate-to-alumni') where exists (select 1 from cron.job where jobname = 'graduate-to-alumni');
select cron.schedule('graduate-to-alumni', '10 10 * * *', $$select public.graduate_to_alumni();$$);

commit;

-- Production records which migration files have run (scripts/apply-migrations.mjs).
do $$
begin
  if to_regclass('ops.applied_migrations') is not null then
    insert into ops.applied_migrations (name)
    values ('0122_message_log.sql'), ('0123_safesport_messaging.sql'), ('0124_graduate_to_alumni.sql')
    on conflict do nothing;
  end if;
end;
$$;

select
  to_regclass('public.message_log') is not null as message_log,
  exists (select 1 from pg_trigger where tgname = 'message_safesport') as safesport_rules,
  exists (select 1 from cron.job where jobname = 'graduate-to-alumni') as graduation_job,
  (select count(*) from public.message_log) as messages_logged,
  (select count(*) from public.chat_group_members where added_for_safesport) as parents_added_to_chats;
