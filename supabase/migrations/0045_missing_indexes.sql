-- These tables are all keyed with a composite primary key whose first
-- column isn't the one several real query paths filter by, so those lookups
-- fall back to a sequential scan. Add the missing side as its own index.
-- (The leading-column lookups — group_id, lineup_id, item_id, guardian_id,
-- profile_id — are already covered by the existing primary keys.)

-- chat_group_members: PK is (group_id, user_id); getUnreadChatCount and the
-- messages list page both look up "which groups is this user in" by user_id
-- alone.
create index if not exists chat_group_members_user_id_idx on chat_group_members (user_id);

-- lineup_seats: PK-equivalent unique index is (lineup_id, seat_number);
-- the home-page lineup banner and the on-water pages both look up seats by
-- rower_id alone.
create index if not exists lineup_seats_rower_id_idx on lineup_seats (rower_id);

-- food_tent_signups: PK is (item_id, user_id); the home-page food tent
-- banner and a user's own signup management both look up by user_id alone.
create index if not exists food_tent_signups_user_id_idx on food_tent_signups (user_id);

-- family_links: PK is (guardian_id, rower_id); a rower's own bio page (and
-- unlinking a rower) looks up by rower_id alone.
create index if not exists family_links_rower_id_idx on family_links (rower_id);
