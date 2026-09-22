import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { ChatGroup, ChatGroupMember, Message, Profile } from "@/lib/database.types";
import { NewChatForm } from "./NewChatForm";

export default async function MessagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membershipData } = await supabase
    .from("chat_group_members")
    .select("group_id, last_read_at")
    .eq("user_id", user.id);
  const memberships =
    (membershipData as Pick<ChatGroupMember, "group_id" | "last_read_at">[] | null) ?? [];

  const groupIds = memberships.map((m) => m.group_id);

  let groups: ChatGroup[] = [];
  const latestByGroup = new Map<string, Message>();
  if (groupIds.length > 0) {
    const { data: groupsData } = await supabase
      .from("chat_groups")
      .select("*")
      .in("id", groupIds);
    groups = (groupsData as ChatGroup[] | null) ?? [];

    const { data: messagesData } = await supabase
      .from("messages")
      .select("*")
      .in("group_id", groupIds)
      .order("created_at", { ascending: false });
    for (const m of (messagesData as Message[] | null) ?? []) {
      if (!latestByGroup.has(m.group_id)) latestByGroup.set(m.group_id, m);
    }
  }

  const lastReadByGroup = new Map(memberships.map((m) => [m.group_id, m.last_read_at]));

  const otherMembersByGroup = new Map<string, string[]>();
  const displayNameByOtherId = new Map<string, string>();
  if (groupIds.length > 0) {
    const { data: allMembersData } = await supabase
      .from("chat_group_members")
      .select("group_id, user_id")
      .in("group_id", groupIds)
      .neq("user_id", user.id);
    const allMembers =
      (allMembersData as Pick<ChatGroupMember, "group_id" | "user_id">[] | null) ?? [];
    for (const m of allMembers) {
      const list = otherMembersByGroup.get(m.group_id) ?? [];
      list.push(m.user_id);
      otherMembersByGroup.set(m.group_id, list);
    }

    const otherIds = [...new Set(allMembers.map((m) => m.user_id))];
    if (otherIds.length > 0) {
      const { data: otherProfilesData } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", otherIds);
      for (const p of (otherProfilesData as Pick<Profile, "id" | "display_name">[] | null) ??
        []) {
        displayNameByOtherId.set(p.id, p.display_name);
      }
    }
  }

  function groupDisplayName(g: ChatGroup): string {
    const otherIds = otherMembersByGroup.get(g.id) ?? [];
    const otherNames = otherIds.map((id) => displayNameByOtherId.get(id) ?? "Unknown");

    if (g.is_direct) return otherNames[0] ?? g.name;
    if (otherNames.length === 0) return g.name;

    const isDefaultName = !g.name || g.name === "New chat";
    return isDefaultName ? otherNames.join(", ") : `${g.name} (${otherNames.join(", ")})`;
  }

  groups.sort((a, b) => {
    const aTime = latestByGroup.get(a.id)?.created_at ?? a.created_at;
    const bTime = latestByGroup.get(b.id)?.created_at ?? b.created_at;
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  });

  const { data: othersData } = await supabase
    .from("profiles")
    .select("*")
    .is("disabled_at", null)
    .neq("id", user.id)
    .order("display_name", { ascending: true });
  const others = (othersData as Profile[] | null) ?? [];

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold">Messages</h1>

      <div className="mt-4">
        <NewChatForm others={others} />
      </div>

      {groups.length === 0 && (
        <p className="text-sm text-gray-500 mt-6">No conversations yet.</p>
      )}

      {groups.length > 0 && (
        <div className="mt-6 flex flex-col gap-1 max-w-md">
          {groups.map((g) => {
            const latest = latestByGroup.get(g.id);
            const lastRead = lastReadByGroup.get(g.id);
            const unread = latest && (!lastRead || new Date(latest.created_at) > new Date(lastRead)) && latest.sender_id !== user.id;
            return (
              <Link
                key={g.id}
                href={`/messages/${g.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border-2 border-[#022e5d] px-4 py-3 hover:bg-[#404040] hover:text-white transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{groupDisplayName(g)}</p>
                  {latest && (
                    <p className="text-xs opacity-70 truncate">{latest.body}</p>
                  )}
                </div>
                {unread && (
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600 shrink-0" />
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
