import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ChatGroup, Message, Profile } from "@/lib/database.types";
import { ChatThread } from "./ChatThread";

export default async function ChatGroupPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("chat_group_members")
    .select("group_id")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) notFound();

  const { data: groupData, error } = await supabase
    .from("chat_groups")
    .select("*")
    .eq("id", groupId)
    .single();
  if (error || !groupData) notFound();
  const group = groupData as ChatGroup;

  const { data: messagesData } = await supabase
    .from("messages")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: true });
  const messages = (messagesData as Message[] | null) ?? [];

  const { data: memberRows } = await supabase
    .from("chat_group_members")
    .select("user_id")
    .eq("group_id", groupId);
  const memberIds = ((memberRows as { user_id: string }[] | null) ?? []).map((m) => m.user_id);

  const { data: sendersData } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", memberIds.length > 0 ? memberIds : [""]);
  const sendersById = new Map(
    ((sendersData as Pick<Profile, "id" | "display_name">[] | null) ?? []).map((p) => [
      p.id,
      p.display_name,
    ])
  );

  const otherMemberIds = memberIds.filter((id) => id !== user.id);
  const otherNames = otherMemberIds.map((id) => sendersById.get(id) ?? "Unknown");

  let displayName = group.name;
  if (group.is_direct) {
    displayName = otherNames[0] ?? group.name;
  } else if (otherNames.length > 0) {
    const isDefaultName = !group.name || group.name === "New chat";
    displayName = isDefaultName ? otherNames.join(", ") : `${group.name} (${otherNames.join(", ")})`;
  }

  return (
    <div className="min-h-screen p-8 flex flex-col h-screen">
      <Link href="/messages" className="text-sm text-gray-500 hover:underline">
        ← Messages
      </Link>
      <h1 className="text-2xl font-bold mt-2 mb-4">{displayName}</h1>

      <ChatThread
        groupId={groupId}
        currentUserId={user.id}
        initialMessages={messages}
        sendersById={Object.fromEntries(sendersById)}
      />
    </div>
  );
}
