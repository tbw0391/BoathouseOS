"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { UserError, tryAction } from "@/lib/userError";
import { CONTACTS_CARD_KEY } from "@/lib/contacts";

// Admin Settings > Board and committees (0109). Admins only; the database
// checks too (profile guard, committee policies).

async function requireAdmin() {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_club_admin");
  if (!isAdmin) throw new UserError("Only admins can change the board and committees.");
  return supabase;
}

function refresh() {
  revalidatePath("/admin/contacts");
  revalidatePath("/contacts");
  revalidatePath("/roster", "layout");
  revalidatePath("/");
}

const JOB_COLUMNS = {
  board: "is_board_member",
  treasurer: "is_treasurer",
  apparel: "is_apparel_chair",
  tent: "is_tent_leader",
} as const;

// Adds someone to the board or a club job (on), or takes them off.
export async function setJob(formData: FormData) {
  return tryAction(async () => {
    const supabase = await requireAdmin();
    const id = String(formData.get("id") ?? "");
    const job = String(formData.get("job") ?? "") as keyof typeof JOB_COLUMNS;
    if (!id) throw new UserError("Pick someone.");
    if (!(job in JOB_COLUMNS)) throw new UserError("Unknown job.");
    const on = formData.get("on") === "1";
    const update: Record<string, boolean | string | null> = { [JOB_COLUMNS[job]]: on };
    // A new board member can get their title at the same time.
    const title = String(formData.get("title") ?? "").trim();
    if (job === "board" && on && title) update.club_title = title.slice(0, 40);
    if (job === "board" && !on) update.club_title = null;
    const { error } = await supabase.from("profiles").update(update).eq("id", id);
    if (error) throw new Error(error.message);
    refresh();
  });
}

export async function setClubTitle(formData: FormData) {
  return tryAction(async () => {
    const supabase = await requireAdmin();
    const id = String(formData.get("id") ?? "");
    const title = String(formData.get("title") ?? "").trim().slice(0, 40) || null;
    const { error } = await supabase.from("profiles").update({ club_title: title }).eq("id", id);
    if (error) throw new Error(error.message);
    refresh();
  });
}

export async function createCommittee(formData: FormData) {
  return tryAction(async () => {
    const supabase = await requireAdmin();
    const name = String(formData.get("name") ?? "").trim().slice(0, 60);
    if (!name) throw new UserError("Give the committee a name.");
    const { error } = await supabase.from("committees").insert({ name });
    if (error) throw new Error(error.message);
    refresh();
  });
}

export async function renameCommittee(formData: FormData) {
  return tryAction(async () => {
    const supabase = await requireAdmin();
    const name = String(formData.get("name") ?? "").trim().slice(0, 60);
    if (!name) throw new UserError("Give the committee a name.");
    const { error } = await supabase.from("committees").update({ name }).eq("id", String(formData.get("id") ?? ""));
    if (error) throw new Error(error.message);
    refresh();
  });
}

export async function deleteCommittee(formData: FormData) {
  return tryAction(async () => {
    const supabase = await requireAdmin();
    const { error } = await supabase.from("committees").delete().eq("id", String(formData.get("id") ?? ""));
    if (error) throw new Error(error.message);
    refresh();
  });
}

export async function addCommitteeMember(formData: FormData) {
  return tryAction(async () => {
    const supabase = await requireAdmin();
    const committeeId = String(formData.get("committee_id") ?? "");
    const profileId = String(formData.get("profile_id") ?? "");
    if (!profileId) throw new UserError("Pick someone.");
    const { error } = await supabase
      .from("committee_members")
      .upsert(
        { committee_id: committeeId, profile_id: profileId, is_chair: formData.get("is_chair") === "on" },
        { onConflict: "committee_id,profile_id" }
      );
    if (error) throw new Error(error.message);
    refresh();
  });
}

export async function updateCommitteeMember(formData: FormData) {
  return tryAction(async () => {
    const supabase = await requireAdmin();
    const committeeId = String(formData.get("committee_id") ?? "");
    const profileId = String(formData.get("profile_id") ?? "");
    const change = String(formData.get("change") ?? "");
    const q =
      change === "remove"
        ? supabase.from("committee_members").delete()
        : supabase.from("committee_members").update({ is_chair: change === "chair" });
    const { error } = await q.eq("committee_id", committeeId).eq("profile_id", profileId);
    if (error) throw new Error(error.message);
    refresh();
  });
}

export async function setContactsCard(formData: FormData) {
  return tryAction(async () => {
    const supabase = await requireAdmin();
    const { error } = await supabase
      .from("club_settings")
      .upsert(
        { key: CONTACTS_CARD_KEY, value: formData.get("show") === "on" ? "on" : "off" },
        { onConflict: "club_id,key" }
      );
    if (error) throw new Error(error.message);
    refresh();
  });
}
