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
  const isManager =
    profile?.role === "admin" || profile?.role === "coach" || profile?.is_tent_leader;

  if (!isManager) throw new Error("Only admins, coaches, and tent leaders can do that.");

  return { user, supabase };
}

export async function createRegattaEvent(formData: FormData) {
  const supabase = await createClient();
  const { user } = await requireManager(supabase);

  const title = String(formData.get("title") ?? "").trim();
  const startsAt = String(formData.get("starts_at") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim() || null;

  if (!title || !startsAt) {
    throw new Error("Title and date are required.");
  }

  const { error } = await supabase.from("schedule_events").insert({
    title,
    starts_at: new Date(startsAt).toISOString(),
    location,
    event_type: "regatta",
    created_by: user.id,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/food-tent");
}

export async function addFoodTentItem(formData: FormData) {
  const supabase = await createClient();
  const { user } = await requireManager(supabase);

  const eventId = String(formData.get("event_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const quantityRaw = String(formData.get("quantity_needed") ?? "1").trim();
  const quantityNeeded = Math.max(1, Number(quantityRaw) || 1);
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!eventId || !title) {
    throw new Error("Item name is required.");
  }

  const { error } = await supabase.from("food_tent_items").insert({
    event_id: eventId,
    title,
    quantity_needed: quantityNeeded,
    notes,
    created_by: user.id,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/food-tent");
}

export async function updateFoodTentItem(formData: FormData) {
  const supabase = await createClient();
  await requireManager(supabase);

  const itemId = String(formData.get("item_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const quantityRaw = String(formData.get("quantity_needed") ?? "1").trim();
  const quantityNeeded = Math.max(1, Number(quantityRaw) || 1);
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!itemId || !title) {
    throw new Error("Item name is required.");
  }

  const { error } = await supabase
    .from("food_tent_items")
    .update({ title, quantity_needed: quantityNeeded, notes })
    .eq("id", itemId);

  if (error) throw new Error(error.message);

  revalidatePath("/food-tent");
}

export async function deleteFoodTentItem(itemId: string) {
  const supabase = await createClient();
  await requireManager(supabase);

  const { error } = await supabase.from("food_tent_items").delete().eq("id", itemId);
  if (error) throw new Error(error.message);

  revalidatePath("/food-tent");
}

export async function signUpForItem(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const itemId = String(formData.get("item_id") ?? "").trim();
  const quantityRaw = String(formData.get("quantity") ?? "1").trim();
  const quantity = Math.max(1, Number(quantityRaw) || 1);

  if (!itemId) throw new Error("Missing item.");

  const { error } = await supabase
    .from("food_tent_signups")
    .upsert({ item_id: itemId, user_id: user.id, quantity }, { onConflict: "item_id,user_id" });

  if (error) throw new Error(error.message);

  revalidatePath("/food-tent");
  revalidatePath("/");
}

export async function cancelSignup(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const itemId = String(formData.get("item_id") ?? "").trim();
  if (!itemId) throw new Error("Missing item.");

  const { error } = await supabase
    .from("food_tent_signups")
    .delete()
    .eq("item_id", itemId)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/food-tent");
  revalidatePath("/");
}
