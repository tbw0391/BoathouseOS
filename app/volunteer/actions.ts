"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireManager(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role, is_tent_leader")
    .eq("id", user.id)
    .single();

  const profile = callerProfile as { role: string; is_tent_leader: boolean } | null;
  const isManager = profile?.role === "admin" || profile?.role === "coach" || profile?.is_tent_leader;
  if (!isManager) {
    throw new Error("Only admins, coaches, and tent leaders can do that.");
  }

  return { user, supabase };
}

export async function createVolunteerNeed(formData: FormData) {
  const supabase = await createClient();
  const { user } = await requireManager(supabase);

  const eventId = String(formData.get("event_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const slotsRaw = String(formData.get("slots_needed") ?? "1").trim();
  const slotsNeeded = Math.max(1, Number(slotsRaw) || 1);
  const description = String(formData.get("description") ?? "").trim() || null;

  if (!eventId || !title) {
    throw new Error("Title is required.");
  }

  const { error } = await supabase.from("volunteer_needs").insert({
    event_id: eventId,
    title,
    slots_needed: slotsNeeded,
    description,
    created_by: user.id,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/volunteer");
  revalidatePath("/");
}

export interface VolunteerNeedImportRow {
  title?: string;
  slots_needed?: string;
  description?: string;
}

export async function importVolunteerNeeds(eventId: string, rows: VolunteerNeedImportRow[]) {
  const supabase = await createClient();
  const { user } = await requireManager(supabase);

  if (!eventId) throw new Error("Missing event.");

  const toInsert: {
    event_id: string;
    title: string;
    slots_needed: number;
    description: string | null;
    created_by: string;
  }[] = [];
  const rowErrors: string[] = [];

  rows.forEach((row, i) => {
    const rowLabel = `Row ${i + 2}`; // +2: header row + 1-index
    const title = String(row.title ?? "").trim();
    if (!title) {
      rowErrors.push(`${rowLabel}: missing title.`);
      return;
    }

    const slotsRaw = String(row.slots_needed ?? "1").trim();
    const slotsNeeded = Math.max(1, Number(slotsRaw) || 1);

    toInsert.push({
      event_id: eventId,
      title,
      slots_needed: slotsNeeded,
      description: String(row.description ?? "").trim() || null,
      created_by: user.id,
    });
  });

  if (toInsert.length === 0) {
    return { imported: 0, errors: rowErrors.length ? rowErrors : ["No valid rows found."] };
  }

  const { error, data } = await supabase.from("volunteer_needs").insert(toInsert).select("id");
  if (error) throw new Error(error.message);

  revalidatePath("/volunteer");
  revalidatePath("/");
  return { imported: data?.length ?? 0, errors: rowErrors };
}

export async function updateVolunteerNeed(formData: FormData) {
  const supabase = await createClient();
  await requireManager(supabase);

  const needId = String(formData.get("need_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const slotsRaw = String(formData.get("slots_needed") ?? "1").trim();
  const slotsNeeded = Math.max(1, Number(slotsRaw) || 1);
  const description = String(formData.get("description") ?? "").trim() || null;

  if (!needId || !title) {
    throw new Error("Title is required.");
  }

  const { error } = await supabase
    .from("volunteer_needs")
    .update({ title, slots_needed: slotsNeeded, description })
    .eq("id", needId);

  if (error) throw new Error(error.message);

  revalidatePath("/volunteer");
}

export async function deleteVolunteerNeed(needId: string) {
  const supabase = await createClient();
  await requireManager(supabase);

  const { error } = await supabase.from("volunteer_needs").delete().eq("id", needId);
  if (error) throw new Error(error.message);

  revalidatePath("/volunteer");
  revalidatePath("/");
}

export async function signUpForNeed(needId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  if (!needId) throw new Error("Missing volunteer slot.");

  const { error } = await supabase
    .from("volunteer_signups")
    .upsert({ need_id: needId, user_id: user.id }, { onConflict: "need_id,user_id" });

  if (error) throw new Error(error.message);

  revalidatePath("/volunteer");
  revalidatePath("/");
}

export async function cancelNeedSignup(needId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  if (!needId) throw new Error("Missing volunteer slot.");

  const { error } = await supabase
    .from("volunteer_signups")
    .delete()
    .eq("need_id", needId)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/volunteer");
  revalidatePath("/");
}
