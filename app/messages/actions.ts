"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPush } from "@/lib/push";
import { UserError } from "@/lib/userError";

export async function createChat(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UserError("Not signed in.");

  const memberIds = formData.getAll("member_ids") as string[];
  const groupName = String(formData.get("group_name") ?? "").trim();

  const participantIds = [...new Set([user.id, ...memberIds])];
  if (participantIds.length < 2) {
    throw new UserError("Pick at least one other person to message.");
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
  if (!user) throw new UserError("Not signed in.");

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;

  const { error } = await supabase
    .from("messages")
    .insert({ group_id: groupId, sender_id: user.id, body });

  if (error) throw new Error(error.message);

  revalidatePath(`/messages/${groupId}`);
  after(() => alertChatMembers(groupId, user.id, body));
}

// "Sam" for a DM, "Sam in Men's" for a group chat.
async function alertChatMembers(groupId: string, senderId: string, body: string) {
  const admin = createAdminClient();
  const [{ data: group }, { data: members }, { data: sender }] = await Promise.all([
    admin.from("chat_groups").select("name, is_direct").eq("id", groupId).single(),
    admin.from("chat_group_members").select("user_id").eq("group_id", groupId),
    admin.from("profiles").select("display_name").eq("id", senderId).single(),
  ]);
  const g = group as { name: string; is_direct: boolean } | null;
  const senderName = (sender as { display_name: string } | null)?.display_name ?? "New message";
  const title = g && !g.is_direct && g.name !== "New chat" ? `${senderName} in ${g.name}` : senderName;
  const recipients = ((members as { user_id: string }[] | null) ?? [])
    .map((m) => m.user_id)
    .filter((id) => id !== senderId);

  await sendPush(recipients, {
    kind: "chat_message",
    title,
    body: body.length > 140 ? `${body.slice(0, 139)}…` : body,
    url: `/messages/${groupId}`,
    tag: `chat-${groupId}`,
  });
}

export async function deleteMessage(groupId: string, messageId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UserError("Not signed in.");

  const { error } = await supabase
    .from("messages")
    .delete()
    .eq("id", messageId)
    .eq("sender_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath(`/messages/${groupId}`);
  revalidatePath("/messages");
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
