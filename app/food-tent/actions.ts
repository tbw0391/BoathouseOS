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

// Tent leader's "review, then publish" step: makes the (possibly
// auto-generated and since-edited) draft list visible to parents and
// flips the event's status, whether or not the automation ever touched it.
export async function publishFoodList(eventId: string) {
  const supabase = await createClient();
  const { user } = await requireManager(supabase);

  if (!eventId) throw new Error("Missing event.");

  const { error: itemsError } = await supabase
    .from("food_tent_items")
    .update({ published: true })
    .eq("event_id", eventId);
  if (itemsError) throw new Error(itemsError.message);

  const now = new Date().toISOString();
  const { error: statusError } = await supabase.from("food_tent_status").upsert(
    {
      event_id: eventId,
      status: "published",
      confirmed_by: user.id,
      confirmed_at: now,
      published_at: now,
    },
    { onConflict: "event_id" }
  );
  if (statusError) throw new Error(statusError.message);

  revalidatePath("/food-tent");
  revalidatePath("/");
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

export interface FoodTentItemImportRow {
  title?: string;
  quantity_needed?: string;
  notes?: string;
}

export async function importFoodTentItems(eventId: string, rows: FoodTentItemImportRow[]) {
  const supabase = await createClient();
  const { user } = await requireManager(supabase);

  if (!eventId) throw new Error("Missing event.");

  const toInsert: { event_id: string; title: string; quantity_needed: number; notes: string | null; created_by: string }[] =
    [];
  const rowErrors: string[] = [];

  rows.forEach((row, i) => {
    const rowLabel = `Row ${i + 2}`; // +2: header row + 1-index
    const title = String(row.title ?? "").trim();
    if (!title) {
      rowErrors.push(`${rowLabel}: missing item name.`);
      return;
    }

    const quantityRaw = String(row.quantity_needed ?? "1").trim();
    const quantityNeeded = Math.max(1, Number(quantityRaw) || 1);

    toInsert.push({
      event_id: eventId,
      title,
      quantity_needed: quantityNeeded,
      notes: String(row.notes ?? "").trim() || null,
      created_by: user.id,
    });
  });

  if (toInsert.length === 0) {
    return { imported: 0, errors: rowErrors.length ? rowErrors : ["No valid rows found."] };
  }

  const { error, data } = await supabase.from("food_tent_items").insert(toInsert).select("id");
  if (error) throw new Error(error.message);

  revalidatePath("/food-tent");
  return { imported: data?.length ?? 0, errors: rowErrors };
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

export async function addWishlistItem(formData: FormData) {
  const supabase = await createClient();
  const { user } = await requireManager(supabase);

  const title = String(formData.get("title") ?? "").trim();
  const quantityRaw = String(formData.get("quantity_needed") ?? "1").trim();
  const quantityNeeded = Math.max(1, Number(quantityRaw) || 1);
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!title) {
    throw new Error("Item name is required.");
  }

  const { error } = await supabase.from("food_tent_wishlist_items").insert({
    title,
    quantity_needed: quantityNeeded,
    notes,
    created_by: user.id,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/food-tent");
}

export async function updateWishlistItem(formData: FormData) {
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
    .from("food_tent_wishlist_items")
    .update({ title, quantity_needed: quantityNeeded, notes })
    .eq("id", itemId);

  if (error) throw new Error(error.message);

  revalidatePath("/food-tent");
}

export async function deleteWishlistItem(itemId: string) {
  const supabase = await createClient();
  await requireManager(supabase);

  const { error } = await supabase.from("food_tent_wishlist_items").delete().eq("id", itemId);
  if (error) throw new Error(error.message);

  revalidatePath("/food-tent");
}

export async function signUpForWishlistItem(formData: FormData) {
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
    .from("food_tent_wishlist_signups")
    .upsert({ item_id: itemId, user_id: user.id, quantity }, { onConflict: "item_id,user_id" });

  if (error) throw new Error(error.message);

  revalidatePath("/food-tent");
}

export async function cancelWishlistSignup(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const itemId = String(formData.get("item_id") ?? "").trim();
  if (!itemId) throw new Error("Missing item.");

  const { error } = await supabase
    .from("food_tent_wishlist_signups")
    .delete()
    .eq("item_id", itemId)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/food-tent");
}
