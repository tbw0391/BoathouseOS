-- Error reports: unexpected server errors (bugs, not "Enter a US mobile
-- number"-style messages) caught by instrumentation.ts. The same error on
-- the same page is one row with a running count; global admins get an email
-- when a new one shows up (at most one per error per hour) and see the list
-- on /global-admin/errors. Written only with the service role. Kept through
-- a demo reset. Safe to re-run.

create table if not exists error_reports (
  id uuid primary key default gen_random_uuid(),
  -- Hash of the message (numbers and ids stripped) and the route.
  fingerprint text not null unique,
  message text not null,
  -- e.g. "/lineups/[eventId]", and whether it was a page, action or route.
  route text,
  route_type text,
  -- The last full URL path and Next.js digest (what the person's screen
  -- shows as "Digest: ...").
  last_path text,
  last_digest text,
  stack text,
  count integer not null default 1,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  last_emailed_at timestamptz,
  resolved_at timestamptz
);

create index if not exists error_reports_last_seen_idx on error_reports (last_seen desc);

alter table error_reports enable row level security;

drop policy if exists "global admins can read error reports" on error_reports;
create policy "global admins can read error reports"
  on error_reports for select
  to authenticated
  using (public.is_global_admin());

create or replace function demo_baseline.excluded_tables()
returns text[]
language sql
immutable
set search_path to ''
as $$
  select array['global_admins', 'interest_signups', 'error_reports']::text[];
$$;

select public.apply_approval_gate();
