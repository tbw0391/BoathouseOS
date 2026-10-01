-- Club website, part 2:
-- - website_pages.menu_group: pages with the same group sit under one
--   drop-down in the site's menu ("About Us", "Programs"...); blank = top level.
-- - A public "website" storage bucket for the site's photos and documents
--   (bylaws, minutes, forms), in a folder per club. Public like the photos
--   bucket: the site is public. Only the service role writes to it (the
--   importer and Admin Settings > Website).
--
-- Safe to re-run.

alter table public.website_pages add column if not exists menu_group text;

insert into storage.buckets (id, name, public, file_size_limit)
values ('website', 'website', true, 26214400)
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit;
