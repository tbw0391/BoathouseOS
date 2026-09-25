-- CrewTimer results sync: a coach pastes the regatta's CrewTimer mobile ID
-- (e.g. "r12967", visible in that regatta's CrewTimer results URL) onto the
-- schedule event once. From then on, opening that regatta's lineups page
-- opportunistically fetches https://crewtimer-results.firebaseio.com — a
-- public, unauthenticated read CrewTimer itself exposes — and fills in
-- place + finish time for any of our boats it can match, the same
-- refresh-on-page-load pattern as event_forecasts.
--
-- Matching is by crew name containing "Westerville" plus a reference
-- rower's last name against CrewTimer's cox column: the coxswain's for a
-- coxed boat (4+/8+), or seat 1's for an uncoxed boat (1x/2x/4x/2-), since
-- that's the only per-entry name column CrewTimer exposes.

alter table schedule_events add column if not exists crewtimer_mobile_id text;
alter table schedule_events add column if not exists crewtimer_synced_at timestamptz;

alter table lineups add column if not exists result_time text;
