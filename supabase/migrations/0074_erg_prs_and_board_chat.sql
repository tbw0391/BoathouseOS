-- 1. Erg time history, so a faster 2K/5K can be spotted as a new PR (the
-- profile only holds the latest time). Filled by a trigger on profiles, so it
-- works whichever way the time gets saved (bio form, admin edit, import).

create table erg_times (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  distance text not null check (distance in ('2k', '5k')),
  time_text text not null,
  seconds numeric not null,
  previous_best_seconds numeric,
  is_pr boolean not null default false,
  recorded_at timestamptz not null default now()
);

create index erg_times_profile_idx on erg_times (profile_id, distance, recorded_at desc);

alter table erg_times enable row level security;

create policy "members read their own erg times, coaches read all"
  on erg_times for select
  to authenticated
  using (
    auth.uid() = profile_id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('coach', 'admin'))
  );

-- "6:45.2" -> 405.2; anything that isn't m:ss(.s) -> null (not tracked).
create or replace function public.erg_seconds(t text)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when t ~ '^\s*\d{1,2}:[0-5]\d(\.\d+)?\s*$'
      then split_part(trim(t), ':', 1)::numeric * 60 + split_part(trim(t), ':', 2)::numeric
  end;
$$;

create or replace function public.log_erg_times()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  d text;
  new_text text;
  old_text text;
  secs numeric;
  best numeric;
begin
  foreach d in array array['2k', '5k'] loop
    new_text := case d when '2k' then new.erg_2k_time else new.erg_5k_time end;
    old_text := case when tg_op = 'UPDATE'
      then case d when '2k' then old.erg_2k_time else old.erg_5k_time end end;
    secs := erg_seconds(new_text);
    if secs is null or new_text is not distinct from old_text then
      continue;
    end if;

    select min(seconds) into best
    from erg_times where profile_id = new.id and distance = d;

    insert into erg_times (profile_id, distance, time_text, seconds, previous_best_seconds, is_pr)
    values (new.id, d, trim(new_text), secs, best, best is not null and secs < best);
  end loop;
  return new;
end;
$$;

revoke execute on function public.log_erg_times() from public, anon, authenticated;

drop trigger if exists profiles_log_erg_times on profiles;
create trigger profiles_log_erg_times
  after insert or update of erg_2k_time, erg_5k_time on profiles
  for each row execute function public.log_erg_times();

-- Today's times become the starting point; none of them count as a PR.
insert into erg_times (profile_id, distance, time_text, seconds)
select id, '2k', trim(erg_2k_time), public.erg_seconds(erg_2k_time)
from profiles where public.erg_seconds(erg_2k_time) is not null
union all
select id, '5k', trim(erg_5k_time), public.erg_seconds(erg_5k_time)
from profiles where public.erg_seconds(erg_5k_time) is not null;

select public.apply_approval_gate();

-- 2. Board chat: one group for everyone flagged as a board member, kept in
-- sync with profiles.is_board_member (like the team chats with profile_teams).

alter table chat_groups add column if not exists is_board boolean not null default false;
create unique index if not exists chat_groups_one_board on chat_groups (is_board) where is_board;

insert into chat_groups (name, is_direct, is_board)
select 'Board', false, true
where not exists (select 1 from chat_groups where is_board);

insert into chat_group_members (group_id, user_id)
select cg.id, p.id
from profiles p
cross join chat_groups cg
where cg.is_board and p.is_board_member
on conflict do nothing;

create or replace function public.sync_board_chat_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  board_group_id uuid;
begin
  select id into board_group_id from chat_groups where is_board;
  if board_group_id is null then
    return new;
  end if;

  if new.is_board_member then
    insert into chat_group_members (group_id, user_id)
    values (board_group_id, new.id)
    on conflict do nothing;
  elsif tg_op = 'UPDATE' and old.is_board_member then
    delete from chat_group_members
    where group_id = board_group_id and user_id = new.id;
  end if;
  return new;
end;
$$;

revoke execute on function public.sync_board_chat_membership() from public, anon, authenticated;

drop trigger if exists profiles_sync_board_chat on profiles;
create trigger profiles_sync_board_chat
  after insert or update of is_board_member on profiles
  for each row execute function public.sync_board_chat_membership();
