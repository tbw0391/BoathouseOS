-- USRowing membership number, shown/edited on a member's bio.
alter table profiles
  add column if not exists us_rowing_number text;
