-- The real bug behind poll creation failing: can_view_poll/can_manage_poll
-- were marked STABLE. Postgres additionally checks a table's SELECT policy
-- against the RETURNING clause of INSERT ... RETURNING (which is what
-- .insert().select() sends) — and a STABLE function's cached snapshot
-- doesn't reliably see a row inserted earlier in that same statement, so
-- the exists() check found nothing and returned false, regardless of the
-- row's actual data. A bare INSERT with no RETURNING worked fine the whole
-- time, which is what made this so confusing. Marking them VOLATILE (the
-- default — dropping the `stable` line) fixes it.

create or replace function can_view_poll(pid uuid)
returns boolean
language sql
security definer
set search_path = public
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

create or replace function can_manage_poll(pid uuid)
returns boolean
language sql
security definer
set search_path = public
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

notify pgrst, 'reload schema';
