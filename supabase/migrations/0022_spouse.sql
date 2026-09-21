-- Optional spouse link between two profiles, so household-wide alerts (e.g.
-- food tent signups) can be shown to either partner regardless of who signed
-- up. Stored one-directionally; lookups check both directions.

alter table profiles
  add column if not exists spouse_id uuid references profiles (id),
  add constraint profiles_spouse_not_self check (spouse_id is null or spouse_id <> id);
