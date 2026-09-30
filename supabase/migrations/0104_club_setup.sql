-- Multi-club, part 2: creating clubs and joining the right one.
--
-- - Each club gets a join code. The roster's "Invite via QR code" link
--   carries it (/signup?join=...), so people who sign up land in that club
--   (still waiting for an admin to approve them). Without a code, signups
--   join the site's club, as before.
-- - A new club comes ready to use: its payment settings row, the team chats
--   and board chat, and the Launch/Recovery task types, same as the demo
--   club got from earlier migrations. Replaces 0103's payment-settings-only
--   trigger.
-- - Global admins create clubs on /global-admin/clubs (service role).
--
-- Safe to re-run.

alter table public.clubs
  add column if not exists join_code text not null
  default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clubs_join_code_key') then
    alter table public.clubs add constraint clubs_join_code_key unique (join_code);
  end if;
end;
$$;

drop trigger if exists clubs_payment_settings on public.clubs;
drop function if exists public.create_club_payment_settings();

create or replace function public.setup_new_club()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into payment_settings (club_id, default_fee_mode)
  values (new.id, 'payer')
  on conflict do nothing;

  insert into chat_groups (name, is_direct, team, club_id)
  values
    ('Men''s', false, 'mens', new.id),
    ('Women''s', false, 'womens', new.id),
    ('Development', false, 'development', new.id),
    ('Masters', false, 'masters', new.id),
    ('Alumni', false, 'alumni', new.id),
    ('Parent', false, 'parent', new.id),
    ('Coach', false, 'coach', new.id)
  on conflict do nothing;

  insert into chat_groups (name, is_direct, is_board, club_id)
  values ('Board', false, true, new.id)
  on conflict do nothing;

  insert into task_types (name, club_id)
  values ('Launch', new.id), ('Recovery', new.id)
  on conflict do nothing;

  return new;
end;
$$;

revoke execute on function public.setup_new_club() from public, anon, authenticated;

drop trigger if exists clubs_setup on public.clubs;
create trigger clubs_setup
  after insert on public.clubs
  for each row execute function public.setup_new_club();

-- Everyone, global admins included, reads only their own club here (pages
-- expect exactly one row). /global-admin/clubs lists them all with the
-- service role.
drop policy if exists "members see their own club" on public.clubs;
create policy "members see their own club"
  on public.clubs for select
  to authenticated
  using (id = (select public.current_club_id()));
