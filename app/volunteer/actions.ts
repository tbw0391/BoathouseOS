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
    .select("role")
    .eq("id", user.id)
    .single();

  const profile = callerProfile as { role: string } | null;
  if (profile?.role !== "admin" && profile?.role !== "coach") {
    throw new Error("Only admins and coaches can do that.");
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
