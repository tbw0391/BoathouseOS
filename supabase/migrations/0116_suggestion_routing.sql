-- Suggestions go to the right people (planned in 0035):
-- - "club" suggestions: one shared list on /suggestions for the club's
--   admins, coaches and board members (Todd, 2026-10-01). All of them can
--   mark one reviewed; only admins delete.
-- - "app" suggestions: BoathouseOS's global admins, on the console
--   (/console/suggestions, read with the service role across every club),
--   plus an email. Club admins no longer see or change them.
-- Whoever sent a suggestion still sees their own.
--
-- Safe to re-run.

create or replace function public.can_review_club_suggestions()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_club_admin() or exists (
    select 1 from profiles
    where id = auth.uid() and approved_at is not null and disabled_at is null
      and (role = 'coach' or is_board_member)
  );
$$;

revoke execute on function public.can_review_club_suggestions() from public, anon;
grant execute on function public.can_review_club_suggestions() to authenticated;

drop policy if exists "admins can read all suggestions" on public.suggestions;
drop policy if exists "admins can update suggestions" on public.suggestions;
drop policy if exists "admins can delete suggestions" on public.suggestions;
drop policy if exists "admins read club suggestions" on public.suggestions;
drop policy if exists "admins update club suggestions" on public.suggestions;

drop policy if exists "reviewers read club suggestions" on public.suggestions;
create policy "reviewers read club suggestions"
  on public.suggestions for select to authenticated
  using (category = 'club' and (select public.can_review_club_suggestions()));

drop policy if exists "reviewers update club suggestions" on public.suggestions;
create policy "reviewers update club suggestions"
  on public.suggestions for update to authenticated
  using (category = 'club' and (select public.can_review_club_suggestions()))
  with check (category = 'club' and (select public.can_review_club_suggestions()));

drop policy if exists "admins delete club suggestions" on public.suggestions;
create policy "admins delete club suggestions"
  on public.suggestions for delete to authenticated
  using (category = 'club' and (select public.is_club_admin()));
