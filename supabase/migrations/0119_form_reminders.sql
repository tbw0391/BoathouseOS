-- Form and election reminders (/forms): when an organizer last tapped
-- "Remind them", so it can only go out every 12 hours. The day-before-closing
-- reminder is claimed in scheduled_alerts_sent (kind "form_closing").
--
-- Safe to re-run.

alter table public.forms add column if not exists reminded_at timestamptz;
