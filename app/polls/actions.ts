"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requirePollCreator(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role, is_board_member")
    .eq("id", user.id)
    .single();

  const profile = callerProfile as { role: string; is_board_member: boolean } | null;
  const canCreate =
    profile?.role === "admin" || profile?.role === "coach" || profile?.is_board_member;

  if (!canCreate) throw new Error("Only admins, coaches, and board members can do that.");

  return { user, supabase };
}

export async function createPoll(formData: FormData) {
  const supabase = await createClient();
  const { user } = await requirePollCreator(supabase);

  const question = String(formData.get("question") ?? "").trim();
  const allowMultiple = formData.get("allow_multiple") === "on";
  const options = String(formData.get("options") ?? "")
    .split("\n")
    .map((o) => o.trim())
    .filter(Boolean);

  if (!question) throw new Error("Question is required.");
  if (options.length < 2) throw new Error("Add at least 2 options (one per line).");

  const { data: poll, error } = await supabase
    .from("polls")
    .insert({ question, allow_multiple: allowMultiple, created_by: user.id })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  const { error: optionsError } = await supabase.from("poll_options").insert(
    options.map((label, i) => ({
      poll_id: (poll as { id: string }).id,
      label,
      position: i,
    }))
  );

  if (optionsError) throw new Error(optionsError.message);

  revalidatePath("/polls");
}

export async function closePoll(pollId: string) {
  const supabase = await createClient();
  await requirePollCreator(supabase);

  const { error } = await supabase
    .from("polls")
    .update({ closed_at: new Date().toISOString() })
    .eq("id", pollId);

  if (error) throw new Error(error.message);

  revalidatePath("/polls");
}

export async function reopenPoll(pollId: string) {
  const supabase = await createClient();
  await requirePollCreator(supabase);

  const { error } = await supabase.from("polls").update({ closed_at: null }).eq("id", pollId);

  if (error) throw new Error(error.message);

  revalidatePath("/polls");
}

export async function deletePoll(pollId: string) {
  const supabase = await createClient();
  await requirePollCreator(supabase);

  const { error } = await supabase.from("polls").delete().eq("id", pollId);
  if (error) throw new Error(error.message);

  revalidatePath("/polls");
}

export async function castVote(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const pollId = String(formData.get("poll_id") ?? "").trim();
  const optionIds = formData.getAll("option_id").map(String);
  if (!pollId) throw new Error("Missing poll.");
  if (optionIds.length === 0) throw new Error("Pick at least one option.");

  const { data: pollData } = await supabase
    .from("polls")
    .select("closed_at")
    .eq("id", pollId)
    .single();
  if ((pollData as { closed_at: string | null } | null)?.closed_at) {
    throw new Error("This poll is closed.");
  }

  // Only accept option ids that actually belong to this poll, so a tampered
  // form can't record a vote against the wrong poll's option.
  const { data: validOptionsData } = await supabase
    .from("poll_options")
    .select("id")
    .eq("poll_id", pollId)
    .in("id", optionIds);
  const validOptionIds = ((validOptionsData as { id: string }[] | null) ?? []).map((o) => o.id);
  if (validOptionIds.length === 0) throw new Error("Invalid option.");

  const { error: deleteError } = await supabase
    .from("poll_votes")
    .delete()
    .eq("poll_id", pollId)
    .eq("user_id", user.id);
  if (deleteError) throw new Error(deleteError.message);

  const { error: insertError } = await supabase.from("poll_votes").insert(
    validOptionIds.map((optionId) => ({
      poll_id: pollId,
      option_id: optionId,
      user_id: user.id,
    }))
  );
  if (insertError) throw new Error(insertError.message);

  revalidatePath("/polls");
}

export async function clearVote(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const pollId = String(formData.get("poll_id") ?? "").trim();
  if (!pollId) throw new Error("Missing poll.");

  const { error } = await supabase
    .from("poll_votes")
    .delete()
    .eq("poll_id", pollId)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/polls");
}
