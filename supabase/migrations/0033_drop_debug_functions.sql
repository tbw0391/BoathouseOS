-- Removes the temporary diagnostic functions added in 0029/0030 while
-- tracking down the poll-creation bug (fixed in 0032/app code) — not part
-- of the app, no longer needed.
drop function if exists debug_list_poll_policies();
drop function if exists debug_poll_insert_check();
