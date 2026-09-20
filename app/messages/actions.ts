"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createChat(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const memberIds = formData.getAll("member_ids") as string[];
  const groupName = String(formData.get("group_name") ?? "").trim();

  const participantIds = [...new Set([user.id, ...memberIds])];
  if (participantIds.length < 2) {
    throw new Error("Pick at least one other person to message.");
  }

  const isDirect = participantIds.length === 2 && !groupName;

  const { data: group, error: groupError } = await supabase
    .from("chat_groups")
    .insert({
      name: groupName || "New chat",
      is_direct: isDirect,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (groupError || !group) {
    throw new Error(groupError?.message ?? "Couldn't create the chat.");
  }

  const { error: membersError } = await supabase
    .from("chat_group_members")
    .insert(participantIds.map((id) => ({ group_id: group.id, user_id: id })));

  if (membersError) throw new Error(membersError.message);

  revalidatePath("/messages");
  return { groupId: group.id as string };
}

export async function sendMessage(groupId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;

  const { error } = await supabase
    .from("messages")
    .insert({ group_id: groupId, sender_id: user.id, body });

  if (error) throw new Error(error.message);

  revalidatePath(`/messages/${groupId}`);
}

export async function markChatRead(groupId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("chat_group_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("group_id", groupId)
    .eq("user_id", user.id);
}
