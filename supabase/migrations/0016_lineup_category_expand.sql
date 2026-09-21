-- Widen the boat category list to also include Masters and Development
-- (each a single class, no varsity/novice split).

do $$
declare
  chk_name text;
begin
  select conname into chk_name
  from pg_constraint
  where conrelid = 'lineups'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%category%';

  if chk_name is not null then
    execute format('alter table lineups drop constraint %I', chk_name);
  end if;
end $$;

alter table lineups
  add constraint lineups_category_check
  check (category in (
    'mens_varsity', 'mens_novice', 'womens_varsity', 'womens_novice',
    'masters', 'development'
  ));
