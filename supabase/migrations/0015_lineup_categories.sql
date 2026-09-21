-- Squad/level category for a boat: Men's/Women's x Varsity/Novice.

alter table lineups
  add column if not exists category text
  check (category in ('mens_varsity', 'mens_novice', 'womens_varsity', 'womens_novice'));
