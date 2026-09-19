-- Which squad/team a member belongs to.

create type team as enum ('mens', 'womens', 'development', 'masters', 'alumni', 'coach', 'parent');

alter table profiles
  add column if not exists team team;
