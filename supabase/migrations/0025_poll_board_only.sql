-- Board-only polls: a poll can be restricted to board members (plus its
-- creator, admins, and any specifically invited people, e.g. a coach the
-- board wants input from). Everyone else can't see the poll exists.

alter table polls add column if not exists board_only boolean not null default false;

create table if not exists poll_invitees (
  poll_id uuid not null references polls (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

alter table poll_invitees enable row level security;

-- Visibility for a poll: open polls are visible to everyone; board_only
-- polls are visible only to the creator, admins, board members, and anyone
-- specifically invited. security definer so it can read poll_invitees
-- without recursing back through poll_invitees' own RLS.
create or replace function can_view_poll(pid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from polls p
    where p.id = pid
      and (
        not p.board_only
        or p.created_by = auth.uid()
        or exists (
          select 1 from profiles pr
          where pr.id = auth.uid() and (pr.role = 'admin' or pr.is_board_member)
        )
        or exists (
          select 1 from poll_invitees pi
          where pi.poll_id = pid and pi.user_id = auth.uid()
        )
      )
  );
$$;

-- Who can manage (edit/close/delete) a given poll: admins, board members, or
-- the poll's own creator — not just any coach, since a coach may not be
-- allowed to even see a board-only poll they didn't create.
create or replace function can_manage_poll(pid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from polls p
    where p.id = pid
      and (
        p.created_by = auth.uid()
        or exists (
          select 1 from profiles pr
          where pr.id = auth.uid() and (pr.role = 'admin' or pr.is_board_member)
        )
      )
  );
$$;

-- ---------- polls ----------
drop policy if exists "polls are readable by authenticated users" on polls;
drop policy if exists "admins, coaches, and board members manage polls" on polls;

create policy "polls are readable by their audience"
  on polls for select
  to authenticated
  using (can_view_poll(id));

create policy "admins, coaches, and board members create polls"
  on polls for insert
  to authenticated
  with check (exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and (p.role in ('admin', 'coach') or p.is_board_member)
  ));

create policy "poll creator, admins, and board members manage polls"
  on polls for update
  to authenticated
  using (can_manage_poll(id))
  with check (can_manage_poll(id));

create policy "poll creator, admins, and board members delete polls"
  on polls for delete
  to authenticated
  using (can_manage_poll(id));

-- ---------- poll_options ----------
drop policy if exists "poll options are readable by authenticated users" on poll_options;
drop policy if exists "admins, coaches, and board members manage poll options" on poll_options;

create policy "poll options are readable by their audience"
  on poll_options for select
  to authenticated
  using (can_view_poll(poll_id));

create policy "poll creator, admins, and board members manage poll options"
  on poll_options for all
  to authenticated
  using (can_manage_poll(poll_id))
  with check (can_manage_poll(poll_id));

-- ---------- poll_votes ----------
drop policy if exists "poll votes are readable by authenticated users" on poll_votes;
drop policy if exists "users manage their own poll vote" on poll_votes;
drop policy if exists "admins, coaches, and board members manage any poll vote" on poll_votes;

create policy "poll votes are readable by the poll's audience"
  on poll_votes for select
  to authenticated
  using (can_view_poll(poll_id));

create policy "users cast their own vote in polls they can see"
  on poll_votes for all
  to authenticated
  using (auth.uid() = user_id and can_view_poll(poll_id))
  with check (auth.uid() = user_id and can_view_poll(poll_id));

create policy "poll creator, admins, and board members manage any vote"
  on poll_votes for all
  to authenticated
  using (can_manage_poll(poll_id))
  with check (can_manage_poll(poll_id));

-- ---------- poll_invitees ----------
create policy "poll managers see and manage invitees"
  on poll_invitees for all
  to authenticated
  using (can_manage_poll(poll_id))
  with check (can_manage_poll(poll_id));

create policy "invitees can see their own invitation"
  on poll_invitees for select
  to authenticated
  using (user_id = auth.uid());
