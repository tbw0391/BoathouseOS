-- Lets admins pick up to 4 site-wide colors (primary/secondary/accent/
-- background) from /admin. Stored as JSON in the existing club_settings
-- key/value table, same pattern as nav_visibility.

insert into club_settings (key, value) values ('theme_colors', null)
on conflict (key) do nothing;

-- Theme colors (and other branding-ish settings) need to render on public
-- pages like /login and /signup, before a session exists, so club_settings
-- reads can no longer be restricted to logged-in users.
drop policy if exists "club settings are readable by authenticated users" on club_settings;

create policy "club settings are readable by anyone"
  on club_settings for select
  to anon, authenticated
  using (true);
