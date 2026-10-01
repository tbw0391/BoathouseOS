-- Website documents can be big (Westerville's parent handbook PDF is 32 MB):
-- allow up to 50 MB per file in the "website" bucket (0113).

update storage.buckets set file_size_limit = 52428800 where id = 'website';
