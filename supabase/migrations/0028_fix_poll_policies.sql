-- Fixes poll creation being broken for everyone: 0025 rewrote the polls/
-- poll_options/poll_votes policies, but CREATE POLICY has no IF NOT EXISTS
-- guard, so if that migration was ever applied more than once (or partially
-- failed), some or all of the new policies never got created — including
-- the INSERT policy, which blocks all poll creation with a plain RLS
-- violation regardless of board_only. This re-asserts every policy from
-- 0025, idempotently, so it reaches the same end state no matter what
-- subset of it previously succeeded.

drop policy if exists "polls are readable by authenticated users" on polls;
drop policy if exists "admins, coaches, and board members manage polls" on polls;
drop policy if exists "polls are readable by their audience" on polls;
drop policy if exists "admins, coaches, and board members create polls" on polls;
drop policy if exists "poll creator, admins, and board members manage polls" on polls;
drop policy if exists "poll creator, admins, and board members delete polls" on polls;

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

drop policy if exists "poll options are readable by authenticated users" on poll_options;
drop policy if exists "admins, coaches, and board members manage poll options" on poll_options;
drop policy if exists "poll options are readable by their audience" on poll_options;
drop policy if exists "poll creator, admins, and board members manage poll options" on poll_options;

create policy "poll options are readable by their audience"
  on poll_options for select
  to authenticated
  using (can_view_poll(poll_id));

create policy "poll creator, admins, and board members manage poll options"
  on poll_options for all
  to authenticated
  using (can_manage_poll(poll_id))
  with check (can_manage_poll(poll_id));

drop policy if exists "poll votes are readable by authenticated users" on poll_votes;
drop policy if exists "users manage their own poll vote" on poll_votes;
drop policy if exists "admins, coaches, and board members manage any poll vote" on poll_votes;
drop policy if exists "poll votes are readable by the poll's audience" on poll_votes;
drop policy if exists "users cast their own vote in polls they can see" on poll_votes;
drop policy if exists "poll creator, admins, and board members manage any vote" on poll_votes;

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

drop policy if exists "poll managers see and manage invitees" on poll_invitees;
drop policy if exists "invitees can see their own invitation" on poll_invitees;

create policy "poll managers see and manage invitees"
  on poll_invitees for all
  to authenticated
  using (can_manage_poll(poll_id))
  with check (can_manage_poll(poll_id));

create policy "invitees can see their own invitation"
  on poll_invitees for select
  to authenticated
  using (user_id = auth.uid());
