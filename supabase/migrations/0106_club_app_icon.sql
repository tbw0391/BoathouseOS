-- Each club's own app name and icon, for members' home screens: the web
-- app manifest (/manifest.json) and the iPhone icon (/club-icon/180) come
-- from the club whose address you're on. Admins set them on /admin. Clubs
-- without one get the BoathouseOS name and icon.
--
-- The icon is kept in the private club-icons bucket as <club_id>/icon.png
-- (512x512) and served, resized, by /club-icon/<size> with the service
-- role; icon_updated_at is put in the icon links so phones pick up a new one.
--
-- Safe to re-run.

alter table public.clubs add column if not exists app_name text;
alter table public.clubs add column if not exists app_short_name text;
alter table public.clubs add column if not exists icon_path text;
alter table public.clubs add column if not exists icon_updated_at timestamptz;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('club-icons', 'club-icons', false, 2097152, array['image/png'])
on conflict (id) do nothing;
