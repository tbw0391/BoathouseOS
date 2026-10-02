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
