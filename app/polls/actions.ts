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

// Editing/closing/deleting an existing poll is narrower than creating one:
// admins, board members, or that specific poll's own creator — not just any
// coach, since a coach may not even be allowed to see a board-only poll
// someone else made. Mirrors the can_manage_poll() DB function.
async function requirePollManager(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pollId: string
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const [{ data: callerProfile }, { data: pollData }] = await Promise.all([
    supabase.from("profiles").select("role, is_board_member").eq("id", user.id).single(),
    supabase.from("polls").select("created_by").eq("id", pollId).maybeSingle(),
  ]);

  const profile = callerProfile as { role: string; is_board_member: boolean } | null;
  const poll = pollData as { created_by: string | null } | null;
  const canManage =
    profile?.role === "admin" || profile?.is_board_member || poll?.created_by === user.id;

  if (!canManage) throw new Error("Only that poll's creator, admins, or board members can do that.");

  return { user, supabase };
}

export async function createPoll(formData: FormData) {
  const supabase = await createClient();
  const { user } = await requirePollCreator(supabase);

  const question = String(formData.get("question") ?? "").trim();
  const allowMultiple = formData.get("allow_multiple") === "on";
  const boardOnly = formData.get("board_only") === "on";
  const inviteeIds = [...new Set(formData.getAll("invitee_id").map(String))];
  const options = String(formData.get("options") ?? "")
    .split("\n")
    .map((o) => o.trim())
    .filter(Boolean);

  if (!question) throw new Error("Question is required.");
  if (options.length < 2) throw new Error("Add at least 2 options (one per line).");

  // Generate the id ourselves and insert without .select(): asking
  // PostgREST to return the inserted row (INSERT ... RETURNING) makes
  // Postgres also re-check the row against the table's SELECT policy
  // (can_view_poll) within the same statement, which can't yet see a row
  // inserted earlier in that same statement — a bare insert avoids that
  // entirely, and we don't need the row handed back since we already know
  // its id.
  const pollId = crypto.randomUUID();
  const { error } = await supabase
    .from("polls")
    .insert({ id: pollId, question, allow_multiple: allowMultiple, board_only: boardOnly, created_by: user.id });

  if (error) throw new Error(error.message);

  const { error: optionsError } = await supabase.from("poll_options").insert(
    options.map((label, i) => ({
      poll_id: pollId,
      label,
      position: i,
    }))
  );

  if (optionsError) throw new Error(optionsError.message);

  if (boardOnly && inviteeIds.length > 0) {
    const { error: inviteesError } = await supabase
      .from("poll_invitees")
      .insert(inviteeIds.map((userId) => ({ poll_id: pollId, user_id: userId })));
    if (inviteesError) throw new Error(inviteesError.message);
  }

  revalidatePath("/polls");
}

export async function updatePoll(formData: FormData) {
  const pollId = String(formData.get("poll_id") ?? "").trim();
  if (!pollId) throw new Error("Missing poll.");

  const supabase = await createClient();
  await requirePollManager(supabase, pollId);

  const question = String(formData.get("question") ?? "").trim();
  const allowMultiple = formData.get("allow_multiple") === "on";
  const boardOnly = formData.get("board_only") === "on";
  const inviteeIds = [...new Set(formData.getAll("invitee_id").map(String))];
  const options = String(formData.get("options") ?? "")
    .split("\n")
    .map((o) => o.trim())
    .filter(Boolean);

  if (!question) throw new Error("Question is required.");
  if (options.length < 2) throw new Error("Add at least 2 options (one per line).");

  const { error: pollError } = await supabase
    .from("polls")
    .update({ question, allow_multiple: allowMultiple, board_only: boardOnly })
    .eq("id", pollId);
  if (pollError) throw new Error(pollError.message);

  // Reconcile options by label instead of wiping and recreating them all:
  // an option whose label didn't change keeps its id (and its votes), an
  // option no longer present gets deleted (cascading its votes), and new
  // labels become new options.
  const { data: existingOptionsData } = await supabase
    .from("poll_options")
    .select("id, label")
    .eq("poll_id", pollId);
  const existingOptions = (existingOptionsData as { id: string; label: string }[] | null) ?? [];
  const existingByLabel = new Map(existingOptions.map((o) => [o.label, o.id]));
  const keptIds = new Set<string>();

  for (let i = 0; i < options.length; i++) {
    const label = options[i];
    const existingId = existingByLabel.get(label);
    if (existingId && !keptIds.has(existingId)) {
      keptIds.add(existingId);
      const { error } = await supabase.from("poll_options").update({ position: i }).eq("id", existingId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("poll_options").insert({ poll_id: pollId, label, position: i });
      if (error) throw new Error(error.message);
    }
  }

  const removedIds = existingOptions.filter((o) => !keptIds.has(o.id)).map((o) => o.id);
  if (removedIds.length > 0) {
    const { error } = await supabase.from("poll_options").delete().in("id", removedIds);
    if (error) throw new Error(error.message);
  }

  const { error: deleteInviteesError } = await supabase
    .from("poll_invitees")
    .delete()
    .eq("poll_id", pollId);
  if (deleteInviteesError) throw new Error(deleteInviteesError.message);

  if (boardOnly && inviteeIds.length > 0) {
    const { error: inviteesError } = await supabase
      .from("poll_invitees")
      .insert(inviteeIds.map((userId) => ({ poll_id: pollId, user_id: userId })));
    if (inviteesError) throw new Error(inviteesError.message);
  }

  revalidatePath("/polls");
}

export async function closePoll(pollId: string) {
  const supabase = await createClient();
  await requirePollManager(supabase, pollId);

  const { error } = await supabase
    .from("polls")
    .update({ closed_at: new Date().toISOString() })
    .eq("id", pollId);

  if (error) throw new Error(error.message);

  revalidatePath("/polls");
}

export async function reopenPoll(pollId: string) {
  const supabase = await createClient();
  await requirePollManager(supabase, pollId);

  const { error } = await supabase.from("polls").update({ closed_at: null }).eq("id", pollId);

  if (error) throw new Error(error.message);

  revalidatePath("/polls");
}

export async function deletePoll(pollId: string) {
  const supabase = await createClient();
  await requirePollManager(supabase, pollId);

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
