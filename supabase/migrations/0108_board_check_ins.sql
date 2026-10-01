-- The coach check-in button is for coaches and board members (profiles
-- with "Board member" ticked), whatever their role; other admins and
-- parents no longer get it (lib/checkIns.ts canCoachCheckIn).
--
-- - Board members can check themselves in.
-- - Everyone can read their own check-ins (the button shows "Checked in at
--   ..."). Coaches and admins still read everyone's.
--
-- Safe to re-run.

drop policy if exists "board members check themselves in" on public.coach_check_ins;
create policy "board members check themselves in"
  on public.coach_check_ins for insert
  to authenticated
  with check (
    profile_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.is_board_member
    )
  );

drop policy if exists "members read their own check-ins" on public.coach_check_ins;
create policy "members read their own check-ins"
  on public.coach_check_ins for select
  to authenticated
  using (profile_id = (select auth.uid()));
