-- Which demo club a race (and a lineup) belongs to, so picking a club on
-- /choose-club shows only the races and lineups that club is entered in.
-- Holds the lib/demoClubs.ts slug of the club that was picked when the race
-- was added. Null = not tied to a club (older rows, or added with no club
-- picked), which every club still sees.

alter table races add column club_slug text;
alter table lineups add column club_slug text;

create index races_event_club_idx on races (event_id, club_slug);
