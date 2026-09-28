-- Email backup for alerts: important alerts are emailed to members who
-- haven't turned on phone alerts, unless they switch it off here. Safe to
-- re-run.

alter table profiles add column if not exists email_alerts boolean not null default true;
