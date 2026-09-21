-- Fleet boats (8s and 4s) can now carry a Men's/Women's + depth designation,
-- the same scheme used for lineups/races/lineup_templates (see
-- 0037_depth_categories.sql) minus masters/development, which aren't a boat
-- designation. Singles/doubles/pairs stay category-less, boat_class-only.
alter table boats add column if not exists category text;

alter table boats add constraint boats_category_check check (category is null or category in (
  'mens_1_8plus','mens_2_8plus','mens_3_8plus','mens_4_8plus',
  'mens_1_4plus','mens_2_4plus','mens_3_4plus','mens_4_4plus',
  'mens_1_4x','mens_2_4x','mens_3_4x','mens_4_4x',
  'mens_1_4minus','mens_2_4minus','mens_3_4minus','mens_4_4minus',
  'womens_1_8plus','womens_2_8plus','womens_3_8plus','womens_4_8plus',
  'womens_1_4plus','womens_2_4plus','womens_3_4plus','womens_4_4plus',
  'womens_1_4x','womens_2_4x','womens_3_4x','womens_4_4x',
  'womens_1_4minus','womens_2_4minus','womens_3_4minus','womens_4_4minus'
));

-- One saved crew per fleet boat, so picking a boat for a race unambiguously
-- resolves to a single default roster instead of a separate template pick.
create unique index if not exists lineup_templates_boat_id_key
  on lineup_templates (boat_id) where boat_id is not null;
