-- Replaces the Men's/Women's Varsity/Novice split with a numbered depth
-- chart (1st-4th) per team boat class (8+, 4+, 4x, 4-). Depth is per boat
-- class, not a fixed team-wide rank — a rower can be in the 1V8 and the
-- 2V4 at the same regatta, in different races. Singles/doubles/pairs (1x,
-- 2x, 2-) intentionally have no depth categories. Masters and Development
-- are unchanged.

-- Step 1: drop the old constraints entirely first, so neither the old nor
-- new category values are validated while we're transitioning between them
-- (the old constraint blocks writing new values; the new one would block
-- the still-unmigrated old values if added too early).
alter table lineups drop constraint if exists lineups_category_check;
alter table races drop constraint if exists races_category_check;
alter table lineup_templates drop constraint if exists lineup_templates_category_check;

-- Step 2: migrate the 2 existing lineups using the old category values.
-- "Varsity" -> 1st, "Novice" -> 2nd is a reasonable default, not a perfect
-- mapping — worth a manual double-check.
update lineups set category = 'mens_1_8plus' where category = 'mens_varsity';
update lineups set category = 'womens_1_8plus' where category = 'womens_varsity';
update lineups set category = 'mens_2_8plus' where category = 'mens_novice';
update lineups set category = 'womens_2_8plus' where category = 'womens_novice';

-- Step 3: now that all data matches the new set, add the new constraints.
do $$
declare
  new_categories text := $list$(
    'mens_1_8plus','mens_2_8plus','mens_3_8plus','mens_4_8plus',
    'mens_1_4plus','mens_2_4plus','mens_3_4plus','mens_4_4plus',
    'mens_1_4x','mens_2_4x','mens_3_4x','mens_4_4x',
    'mens_1_4minus','mens_2_4minus','mens_3_4minus','mens_4_4minus',
    'womens_1_8plus','womens_2_8plus','womens_3_8plus','womens_4_8plus',
    'womens_1_4plus','womens_2_4plus','womens_3_4plus','womens_4_4plus',
    'womens_1_4x','womens_2_4x','womens_3_4x','womens_4_4x',
    'womens_1_4minus','womens_2_4minus','womens_3_4minus','womens_4_4minus',
    'masters','development'
  )$list$;
begin
  execute format('alter table lineups add constraint lineups_category_check check (category in %s)', new_categories);
  execute format('alter table races add constraint races_category_check check (category in %s)', new_categories);
  execute format('alter table lineup_templates add constraint lineup_templates_category_check check (category in %s)', new_categories);
end $$;
