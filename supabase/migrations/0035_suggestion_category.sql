-- Suggestions are now categorized as "club" (about this club's operations)
-- or "app" (about the software itself). Both currently route to the same
-- single admin role — once the planned Club admin / Global admin split
-- exists (see BACKLOG.md, Multi-tenant SaaS), "app" suggestions should
-- route to Global admins and "club" ones stay with each club's own admins.
alter table suggestions
  add column if not exists category text not null default 'club'
    check (category in ('club', 'app'));
