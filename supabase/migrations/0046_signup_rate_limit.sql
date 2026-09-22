-- Backs app-level rate limiting on the public /signup form (app/signup/actions.ts),
-- which calls admin.auth.admin.createUser directly and so bypasses whatever
-- rate limiting Supabase applies to its own public signup endpoint. Only the
-- service-role client (which bypasses RLS) ever touches this table, so it's
-- left with RLS enabled and no policies — anon/authenticated get nothing.
create table if not exists signup_attempts (
  id bigint generated always as identity primary key,
  ip text not null,
  created_at timestamptz not null default now()
);

create index if not exists signup_attempts_ip_created_at_idx
  on signup_attempts (ip, created_at);

alter table signup_attempts enable row level security;
