-- The messages list page pulled every message across all of a user's chat
-- groups (no limit) just to find the single latest one per group. That's an
-- ever-growing full read as message history accumulates. This RPC does it in
-- one indexed query instead. security invoker (the default) means it still
-- runs under the caller's RLS, so it only ever returns messages from groups
-- the caller can already read via is_chat_group_member().
create or replace function latest_messages_for_groups(gids uuid[])
returns setof messages
language sql
stable
as $$
  select distinct on (group_id) *
  from messages
  where group_id = any(gids)
  order by group_id, created_at desc;
$$;
