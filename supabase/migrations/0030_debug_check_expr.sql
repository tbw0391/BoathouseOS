-- TEMPORARY diagnostic — evaluates the poll-insert WITH CHECK expression
-- (and related facts) as the CALLING user (security invoker, so it's
-- subject to the same RLS the caller would see), to isolate why the actual
-- policy is denying inserts despite looking correct.
create or replace function debug_poll_insert_check()
returns table (
  auth_uid uuid,
  profile_role text,
  profile_is_board_member boolean,
  check_expr boolean
)
language sql
security invoker
set search_path = public
stable
as $$
  select
    auth.uid(),
    (select role::text from profiles p where p.id = auth.uid()),
    (select is_board_member from profiles p where p.id = auth.uid()),
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and (p.role in ('admin', 'coach') or p.is_board_member)
    );
$$;

grant execute on function debug_poll_insert_check() to authenticated;
