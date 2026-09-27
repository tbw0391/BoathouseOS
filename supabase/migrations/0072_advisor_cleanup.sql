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
