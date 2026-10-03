-- Which CrewTimer regatta a regatta's races came from, and the club's crew
-- name there, so its Results tab can show live places and times (and copy
-- them onto lineups) for any CrewTimer regatta, not just the Head of the
-- Cuyahoga. Set by "From CrewTimer" on import, or by a coach on the Results
-- tab. Safe to re-run.

alter table schedule_events add column if not exists crewtimer_url text;
alter table schedule_events add column if not exists crewtimer_crew text;
