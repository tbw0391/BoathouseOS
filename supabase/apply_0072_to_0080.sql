-- All of migrations 0072-0080 in one script, for pasting into the Supabase
-- SQL editor (Dashboard -> SQL Editor -> New query -> paste -> Run).
-- Safe to run even if some of these are already applied: every step checks
-- first. It all runs as one transaction, so it either fully applies or
-- changes nothing. Generated from the files in supabase/migrations/, which
-- stay the source of truth.

begin;

-- ============================================================
-- 0072_advisor_cleanup.sql
-- ============================================================

-- Security advisor leftovers.

-- 1. Pin search_path on the functions that didn't set one.
alter function public.latest_messages_for_groups(uuid[]) set search_path = public;
alter function public.guard_payment_settings_stripe() set search_path = public;
alter function demo_baseline.excluded_tables() set search_path = '';

-- 2. Trigger functions only run from their triggers (firing a trigger
-- doesn't check EXECUTE), so nobody needs to call them over the API.
revoke execute on function public.create_lineup_chat() from public, anon, authenticated;
revoke execute on function public.guard_profile_privileged_columns() from public, anon, authenticated;
revoke execute on function public.pick_on_water_color() from public, anon, authenticated;
revoke execute on function public.sync_lineup_seat_chat_membership() from public, anon, authenticated;
revoke execute on function public.sync_team_chat_membership() from public, anon, authenticated;

-- 3. The regatta prep job runs from pg_cron as postgres; members shouldn't
-- be able to kick it off early.
revoke execute on function public.generate_regatta_prep() from public, anon, authenticated;

-- 4. RLS helpers: signed-in members need them (policies call them as the
-- user), signed-out visitors don't. No policy that applies to anon uses them.
revoke execute on function public.can_manage_poll(uuid) from public, anon;
revoke execute on function public.can_see_rower(uuid) from public, anon;
revoke execute on function public.can_view_poll(uuid) from public, anon;
revoke execute on function public.is_chat_group_member(uuid) from public, anon;
revoke execute on function public.is_coach_or_admin() from public, anon;
revoke execute on function public.is_treasurer() from public, anon;
grant execute on function public.can_manage_poll(uuid) to authenticated;
grant execute on function public.can_see_rower(uuid) to authenticated;
grant execute on function public.can_view_poll(uuid) to authenticated;
grant execute on function public.is_chat_group_member(uuid) to authenticated;
grant execute on function public.is_coach_or_admin() to authenticated;
grant execute on function public.is_treasurer() to authenticated;

-- ============================================================
-- 0073_delete_own_messages.sql
-- ============================================================

-- Let people delete messages they sent.

drop policy if exists "senders can delete their own messages" on messages;
create policy "senders can delete their own messages"
  on messages for delete
  to authenticated
  using (auth.uid() = sender_id);

-- ============================================================
-- 0074_erg_prs_and_board_chat.sql
-- ============================================================

-- 1. Erg time history, so a faster 2K/5K can be spotted as a new PR (the
-- profile only holds the latest time). Filled by a trigger on profiles, so it
-- works whichever way the time gets saved (bio form, admin edit, import).

create table if not exists erg_times (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  distance text not null check (distance in ('2k', '5k')),
  time_text text not null,
  seconds numeric not null,
  previous_best_seconds numeric,
  is_pr boolean not null default false,
  recorded_at timestamptz not null default now()
);

create index if not exists erg_times_profile_idx on erg_times (profile_id, distance, recorded_at desc);

alter table erg_times enable row level security;

drop policy if exists "members read their own erg times, coaches read all" on erg_times;
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
-- (Only the first time this runs.)
insert into erg_times (profile_id, distance, time_text, seconds)
select * from (
  select id, '2k', trim(erg_2k_time), public.erg_seconds(erg_2k_time)
  from profiles where public.erg_seconds(erg_2k_time) is not null
  union all
  select id, '5k', trim(erg_5k_time), public.erg_seconds(erg_5k_time)
  from profiles where public.erg_seconds(erg_5k_time) is not null
) baseline
where not exists (select 1 from erg_times);

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

-- ============================================================
-- 0075_terms_acceptance.sql
-- ============================================================

-- When each member agreed to the Terms and Privacy Policy, and which version
-- (lib/terms.ts TERMS_VERSION). Set at signup; null for members added by an
-- admin or who joined before the Terms existed.

alter table profiles
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version text;

-- ============================================================
-- 0076_push_subscriptions.sql
-- ============================================================

-- Phone/browser push subscriptions: one row per device someone turned alerts
-- on for. Sending happens server-side with the service-role client
-- (lib/push.ts), which also drops subscriptions the push service says are gone.

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

drop policy if exists "members manage their own push subscriptions" on push_subscriptions;
create policy "members manage their own push subscriptions"
  on push_subscriptions for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

select public.apply_approval_gate();

-- ============================================================
-- 0077_admins_can_cox.sql
-- ============================================================

-- Admins can also cox: they can start GPS tracking for their own boat, same
-- as a coxswain (they already see every boat on the map).

drop policy if exists "coxswains start their own session" on on_water_sessions;

create policy "coxswains start their own session"
  on on_water_sessions for insert
  to authenticated
  with check (
    auth.uid() = coxswain_id
    and exists (
      select 1 from profiles p where p.id = auth.uid() and p.role in ('coxswain', 'admin')
    )
  );

-- ============================================================
-- 0078_photo_likes_and_comments.sql
-- ============================================================

-- Likes and comments on team photos.

create table if not exists photo_likes (
  photo_id uuid not null references photos (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (photo_id, profile_id)
);

alter table photo_likes enable row level security;

drop policy if exists "photo likes are readable by authenticated users" on photo_likes;
create policy "photo likes are readable by authenticated users"
  on photo_likes for select
  to authenticated
  using (true);

drop policy if exists "members like as themselves" on photo_likes;
create policy "members like as themselves"
  on photo_likes for insert
  to authenticated
  with check (auth.uid() = profile_id);

drop policy if exists "members unlike their own likes" on photo_likes;
create policy "members unlike their own likes"
  on photo_likes for delete
  to authenticated
  using (auth.uid() = profile_id);

create table if not exists photo_comments (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references photos (id) on delete cascade,
  author_id uuid not null references profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists photo_comments_photo_idx on photo_comments (photo_id, created_at);

alter table photo_comments enable row level security;

drop policy if exists "photo comments are readable by authenticated users" on photo_comments;
create policy "photo comments are readable by authenticated users"
  on photo_comments for select
  to authenticated
  using (true);

drop policy if exists "members comment as themselves" on photo_comments;
create policy "members comment as themselves"
  on photo_comments for insert
  to authenticated
  with check (auth.uid() = author_id);

drop policy if exists "author or staff can delete a comment" on photo_comments;
create policy "author or staff can delete a comment"
  on photo_comments for delete
  to authenticated
  using (
    auth.uid() = author_id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'coach'))
  );

select public.apply_approval_gate();

-- ============================================================
-- 0079_everyone_sees_boats_on_water.sql
-- ============================================================

-- Everyone in the club can watch the boats that are on the water right now
-- (the On the Water tab). Only outings still going, and only each boat's last
-- 15 minutes of positions; full tracks and past outings stay with coaches,
-- admins, and the coxswain who recorded them (policies from 0020).

drop policy if exists "members see boats on the water now" on on_water_sessions;
create policy "members see boats on the water now"
  on on_water_sessions for select
  to authenticated
  using (ended_at is null);

drop policy if exists "members see recent positions of boats on the water now" on location_pings;
create policy "members see recent positions of boats on the water now"
  on location_pings for select
  to authenticated
  using (
    recorded_at > now() - interval '15 minutes'
    and exists (
      select 1 from on_water_sessions s
      where s.id = location_pings.session_id and s.ended_at is null
    )
  );

-- ============================================================
-- 0080_scheduled_alerts.sql
-- ============================================================

-- Scheduled push alerts: food list draft ready, bill due soon / overdue.
-- Every 5 minutes pg_cron calls /api/cron/alerts (pg_net), which works out
-- what's due and sends it. (Vercel's own cron only runs daily on the Hobby
-- plan.) Race-time alerts were left out on purpose: regattas run late.
--
-- Setup, once: pick a long random secret, add it to Vercel as CRON_SECRET,
-- and store the same value here:
--   select vault.create_secret('<the secret>', 'cron_secret');
-- Until both are set the calls are rejected and nothing is sent.

-- What's been sent, so each alert goes out once even if runs overlap.
create table if not exists scheduled_alerts_sent (
  kind text not null,
  ref text not null,
  sent_at timestamptz not null default now(),
  primary key (kind, ref)
);

-- Service role only: no policies, so members can't read or write it.
alter table scheduled_alerts_sent enable row level security;

-- Parents follow boats on the On the Water page to hear when they go out.
create table if not exists on_water_follows (
  profile_id uuid not null references profiles (id) on delete cascade,
  boat_id uuid not null references boats (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, boat_id)
);

alter table on_water_follows enable row level security;

drop policy if exists "members manage the boats they follow" on on_water_follows;
create policy "members manage the boats they follow"
  on on_water_follows for all
  to authenticated
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

select public.apply_approval_gate();

create extension if not exists pg_net with schema extensions;

select cron.unschedule(jobid) from cron.job where jobname = 'scheduled-alerts';

select cron.schedule(
  'scheduled-alerts',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://www.boathouseos.app/api/cron/alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(
        (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'), ''
      )
    ),
    body := '{}'::jsonb
  );
  $$
);

commit;
