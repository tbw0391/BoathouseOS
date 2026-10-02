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
