-- Volunteers (suggestion, 2026-10-02): schedule_events.has_volunteers is off
-- for a regatta that doesn't need volunteers, like has_food_tent (0118).
-- Then the app hides its volunteer slots, sign-up buttons, banners and the
-- "Sign up for a volunteer slot" reminder. Tent leaders, coaches and admins
-- change it through a server action (tent leaders can't edit the schedule
-- otherwise).
--
-- Safe to re-run.

alter table public.schedule_events add column if not exists has_volunteers boolean not null default true;
