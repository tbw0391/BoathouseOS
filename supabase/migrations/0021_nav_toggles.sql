-- Lets admins hide individual home-page buttons (e.g. Live Tracking while
-- it's still being tested) without touching code. Stored as a JSON array of
-- hrefs in the existing club_settings key/value table.

insert into club_settings (key, value) values ('nav_disabled_hrefs', '[]')
on conflict (key) do nothing;
