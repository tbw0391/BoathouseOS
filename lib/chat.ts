import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ChatGroupMember } from "@/lib/database.types";

export async function getUnreadChatCount(userId: string): Promise<number> {
  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from("chat_group_members")
    .select("group_id, last_read_at")
    .eq("user_id", userId);
  const rows = (memberships as Pick<ChatGroupMember, "group_id" | "last_read_at">[] | null) ?? [];

  if (rows.length === 0) return 0;

  const counts = await Promise.all(
    rows.map(async (m) => {
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("group_id", m.group_id)
        .neq("sender_id", userId)
        .gt("created_at", m.last_read_at);
      return count ?? 0;
    })
  );

  return counts.reduce((sum, c) => sum + c, 0);
}
