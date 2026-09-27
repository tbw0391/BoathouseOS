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
