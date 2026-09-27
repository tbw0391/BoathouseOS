-- 0080 installed pg_net in the public schema; Supabase's advisor wants
-- extensions in "extensions". pg_net can't be moved with ALTER EXTENSION, so
-- drop and recreate it. Its functions live in the "net" schema either way,
-- so the scheduled-alerts cron job (which calls net.http_post) is unaffected.

drop extension if exists pg_net;
create extension if not exists pg_net with schema extensions;
