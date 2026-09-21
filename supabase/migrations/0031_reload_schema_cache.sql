-- Forces PostgREST to drop its connection pool and re-read the current
-- schema/policies, clearing any stale cached query plans left over from the
-- RLS policy edits in 0025/0028 (this is what the dashboard's "Reload
-- schema cache" button does under the hood).
notify pgrst, 'reload schema';
