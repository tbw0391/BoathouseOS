-- Adds flat 'mens_novice'/'womens_novice' lineup categories, alongside the
-- existing flat 'masters'/'development' categories — no depth split, same
-- pattern. Not added to boat_categories: like masters/development, novice is
-- never a Fleet boat's own "category" (only lineups/races/templates use it).

alter table lineups drop constraint if exists lineups_category_check;
alter table races drop constraint if exists races_category_check;
alter table lineup_templates drop constraint if exists lineup_templates_category_check;
alter table boats drop constraint if exists boats_category_check;

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
    'masters_1_8plus','masters_2_8plus','masters_3_8plus',
    'masters_1_4plus','masters_2_4plus','masters_3_4plus',
    'masters','development','mens_novice','womens_novice'
  )$list$;
  boat_categories text := $list$(
    'mens_1_8plus','mens_2_8plus','mens_3_8plus','mens_4_8plus',
    'mens_1_4plus','mens_2_4plus','mens_3_4plus','mens_4_4plus',
    'mens_1_4x','mens_2_4x','mens_3_4x','mens_4_4x',
    'mens_1_4minus','mens_2_4minus','mens_3_4minus','mens_4_4minus',
    'womens_1_8plus','womens_2_8plus','womens_3_8plus','womens_4_8plus',
    'womens_1_4plus','womens_2_4plus','womens_3_4plus','womens_4_4plus',
    'womens_1_4x','womens_2_4x','womens_3_4x','womens_4_4x',
    'womens_1_4minus','womens_2_4minus','womens_3_4minus','womens_4_4minus',
    'masters_1_8plus','masters_2_8plus','masters_3_8plus',
    'masters_1_4plus','masters_2_4plus','masters_3_4plus'
  )$list$;
begin
  execute format('alter table lineups add constraint lineups_category_check check (category in %s)', new_categories);
  execute format('alter table races add constraint races_category_check check (category in %s)', new_categories);
  execute format('alter table lineup_templates add constraint lineup_templates_category_check check (category in %s)', new_categories);
  execute format('alter table boats add constraint boats_category_check check (category is null or category in %s)', boat_categories);
end $$;
