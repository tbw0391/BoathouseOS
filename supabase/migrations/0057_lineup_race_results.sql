-- Race results: a coach marks a boat's race as finished by recording its
-- finishing place. Lives on `lineups` (not `races`) since race_name/
-- race_time already work this way — a lineup's own race info is an
-- editable snapshot, not a live join back to the races table, and not
-- every lineup even came from an imported race row.

alter table lineups add column place integer;
alter table lineups add constraint lineups_place_positive check (place is null or place > 0);
