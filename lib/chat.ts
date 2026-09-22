import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ChatGroupMember, Message } from "@/lib/database.types";

export async function getUnreadChatCount(userId: string): Promise<number> {
  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from("chat_group_members")
    .select("group_id, last_read_at")
    .eq("user_id", userId);
  const rows = (memberships as Pick<ChatGroupMember, "group_id" | "last_read_at">[] | null) ?? [];

  if (rows.length === 0) return 0;

  // One query across all of the user's groups instead of one count query per
  // group: fetch anything newer than the earliest last_read_at, then compare
  // each row against its own group's cutoff in memory.
  const lastReadByGroup = new Map(rows.map((r) => [r.group_id, r.last_read_at]));
  const earliestLastRead = rows.reduce(
    (min, r) => (r.last_read_at < min ? r.last_read_at : min),
    rows[0].last_read_at
  );

  const { data: messages } = await supabase
    .from("messages")
    .select("group_id, created_at")
    .in(
      "group_id",
      rows.map((r) => r.group_id)
    )
    .neq("sender_id", userId)
    .gt("created_at", earliestLastRead);

  let unread = 0;
  for (const m of (messages as Pick<Message, "group_id" | "created_at">[] | null) ?? []) {
    const lastRead = lastReadByGroup.get(m.group_id);
    if (lastRead && m.created_at > lastRead) unread++;
  }
  return unread;
}
