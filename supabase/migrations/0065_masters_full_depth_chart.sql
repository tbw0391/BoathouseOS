-- Gives Masters the same depth chart as Men's and Women's: 1st-4th in 8+,
-- 4+, 4x and 4- (it was 1st-3rd in 8+/4+ only, per 0041). The flat
-- 'masters' and 'development' categories stay allowed on lineups/races/
-- templates for older data, same as before.

alter table lineups drop constraint if exists lineups_category_check;
alter table races drop constraint if exists races_category_check;
alter table lineup_templates drop constraint if exists lineup_templates_category_check;
alter table boats drop constraint if exists boats_category_check;

do $$
declare
  depth_categories text[];
  all_categories text[];
begin
  select array_agg(format('%s_%s_%s', g, d, c) order by g, c, d)
  into depth_categories
  from unnest(array['mens', 'womens', 'masters']) g,
       generate_series(1, 4) d,
       unnest(array['8plus', '4plus', '4x', '4minus']) c;
  all_categories := depth_categories || array['masters', 'development'];

  execute format('alter table lineups add constraint lineups_category_check check (category = any (%L::text[]))', all_categories);
  execute format('alter table races add constraint races_category_check check (category = any (%L::text[]))', all_categories);
  execute format('alter table lineup_templates add constraint lineup_templates_category_check check (category = any (%L::text[]))', all_categories);
  execute format('alter table boats add constraint boats_category_check check (category is null or category = any (%L::text[]))', depth_categories);
end $$;
