-- Size and type limits on the public upload buckets. Both were unlimited, so
-- any signed-in member could upload any file type (including HTML or SVG,
-- served from a public URL) at any size. The app only ever uploads images
-- (accept="image/*" in BioForm and PhotoUploadForm). SVG is deliberately
-- left out since it can carry script.

update storage.buckets
set file_size_limit = 5 * 1024 * 1024,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
where id = 'avatars';

update storage.buckets
set file_size_limit = 15 * 1024 * 1024,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
where id = 'photos';
