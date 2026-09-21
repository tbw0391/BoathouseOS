-- TEMPORARY diagnostic helper — not part of the app, safe to drop later.
-- Lets us inspect from outside the SQL editor exactly which RLS policies
-- currently exist on the poll-related tables, since poll creation is still
-- failing after 0028 was reportedly applied successfully.
create or replace function debug_list_poll_policies()
returns table (
  tablename text,
  policyname text,
  cmd text,
  permissive text,
  roles text,
  qual text,
  with_check text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    tablename::text,
    policyname::text,
    cmd::text,
    permissive::text,
    roles::text,
    qual::text,
    with_check::text
  from pg_policies
  where schemaname = 'public'
    and tablename in ('polls', 'poll_options', 'poll_votes', 'poll_invitees')
  order by tablename, policyname;
$$;

grant execute on function debug_list_poll_policies() to authenticated, service_role;
