-- Fix a chicken-and-egg bug: creating a chat group does
-- `insert(...).select("id").single()` to get the new row's id back, but the
-- select policy only allowed people who are already a member of the group —
-- and the creator isn't added as a member until the very next statement. So
-- PostgREST couldn't return the row it just inserted, which Supabase surfaces
-- as an RLS violation (42501) instead of an empty result. Let the creator
-- always see groups they created, in addition to groups they belong to.

drop policy if exists "group members can read their groups" on chat_groups;
create policy "group members can read their groups"
  on chat_groups for select
  to authenticated
  using (is_chat_group_member(id) or created_by = auth.uid());
