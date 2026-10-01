"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { activeMemberIds, familyMemberIds, sendPush } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { myClubId } from "@/lib/clubs";
import { UserError, tryAction } from "@/lib/userError";

async function requireManager(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UserError("Not signed in.");

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role, is_tent_leader")
    .eq("id", user.id)
    .single();

  const profile = callerProfile as { role: string; is_tent_leader: boolean } | null;
  const isManager =
    profile?.role === "admin" || profile?.role === "coach" || profile?.is_tent_leader;

  if (!isManager) throw new UserError("Only admins, coaches, and tent leaders can do that.");

  return { user, supabase };
}

export async function createRegattaEvent(formData: FormData) {
  return tryAction(async () => {
    const supabase = await createClient();
    const { user } = await requireManager(supabase);

    const title = String(formData.get("title") ?? "").trim();
    const startsAt = String(formData.get("starts_at") ?? "").trim();
    const location = String(formData.get("location") ?? "").trim() || null;

    if (!title || !startsAt) {
      throw new UserError("Title and date are required.");
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
  });
}

// Tent leader's "review, then publish" step: makes the (possibly
// auto-generated and since-edited) draft list visible to parents and
// flips the event's status, whether or not the automation ever touched it.
export async function publishFoodList(eventId: string) {
  return tryAction(async () => {
    const supabase = await createClient();
    const { user } = await requireManager(supabase);

    if (!eventId) throw new UserError("Missing event.");

    const { data: eventRow } = await supabase.from("schedule_events").select("has_food_tent").eq("id", eventId).single();
    if ((eventRow as { has_food_tent: boolean } | null)?.has_food_tent === false) {
      throw new UserError("This regatta is set to no food tent. Turn the food tent back on first.");
    }

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

    after(async () => {
      const { data: event } = await supabase
        .from("schedule_events")
        .select("title")
        .eq("id", eventId)
        .single();
      await sendPush(
        (await familyMemberIds(await myClubId())).filter((id) => id !== user.id),
        {
          kind: "food_published",
          title: "Food tent signups are open",
          body: `${(event as { title: string } | null)?.title ?? "The next regatta"}: pick something to bring.`,
          url: "/food-tent",
          tag: `food-${eventId}`,
        }
      );
    });
  });
}

// Wipes one regatta's food list (items, their signups, and its publish
// status). The regatta itself stays on the schedule.
export async function clearFoodList(eventId: string) {
  return tryAction(async () => {
    const supabase = await createClient();
    await requireManager(supabase);

    if (!eventId) throw new UserError("Missing event.");

    const { error: itemsError } = await supabase
      .from("food_tent_items")
      .delete()
      .eq("event_id", eventId);
    if (itemsError) throw new Error(itemsError.message);

    const { error: statusError } = await supabase
      .from("food_tent_status")
      .delete()
      .eq("event_id", eventId);
    if (statusError) throw new Error(statusError.message);

    revalidatePath("/food-tent");
    revalidatePath("/");
  });
}

export async function addFoodTentItem(formData: FormData) {
  return tryAction(async () => {
    const supabase = await createClient();
    const { user } = await requireManager(supabase);

    const eventId = String(formData.get("event_id") ?? "").trim();
    const title = String(formData.get("title") ?? "").trim();
    const quantityRaw = String(formData.get("quantity_needed") ?? "1").trim();
    const quantityNeeded = Math.max(1, Number(quantityRaw) || 1);
    const notes = String(formData.get("notes") ?? "").trim() || null;

    if (!eventId || !title) {
      throw new UserError("Item name is required.");
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
  });
}

export interface FoodTentItemImportRow {
  title?: string;
  quantity_needed?: string;
  notes?: string;
}

export async function importFoodTentItems(eventId: string, rows: FoodTentItemImportRow[]) {
  return tryAction(async () => {
    const supabase = await createClient();
    const { user } = await requireManager(supabase);

    if (!eventId) throw new UserError("Missing event.");

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
  });
}

export async function updateFoodTentItem(formData: FormData) {
  return tryAction(async () => {
    const supabase = await createClient();
    await requireManager(supabase);

    const itemId = String(formData.get("item_id") ?? "").trim();
    const title = String(formData.get("title") ?? "").trim();
    const quantityRaw = String(formData.get("quantity_needed") ?? "1").trim();
    const quantityNeeded = Math.max(1, Number(quantityRaw) || 1);
    const notes = String(formData.get("notes") ?? "").trim() || null;

    if (!itemId || !title) {
      throw new UserError("Item name is required.");
    }

    const { error } = await supabase
      .from("food_tent_items")
      .update({ title, quantity_needed: quantityNeeded, notes })
      .eq("id", itemId);

    if (error) throw new Error(error.message);

    revalidatePath("/food-tent");
  });
}

export async function deleteFoodTentItem(itemId: string) {
  const supabase = await createClient();
  await requireManager(supabase);

  const { error } = await supabase.from("food_tent_items").delete().eq("id", itemId);
  if (error) throw new Error(error.message);

  revalidatePath("/food-tent");
}

export async function signUpForItem(formData: FormData) {
  return tryAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UserError("Not signed in.");

    const itemId = String(formData.get("item_id") ?? "").trim();
    const quantityRaw = String(formData.get("quantity") ?? "1").trim();
    const quantity = Math.max(1, Number(quantityRaw) || 1);

    if (!itemId) throw new UserError("Missing item.");

    const { error } = await supabase
      .from("food_tent_signups")
      .upsert({ item_id: itemId, user_id: user.id, quantity }, { onConflict: "item_id,user_id" });

    if (error) throw new Error(error.message);

    revalidatePath("/food-tent");
    revalidatePath("/");
  });
}

export async function cancelSignup(formData: FormData) {
  return tryAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UserError("Not signed in.");

    const itemId = String(formData.get("item_id") ?? "").trim();
    if (!itemId) throw new UserError("Missing item.");

    const { error } = await supabase
      .from("food_tent_signups")
      .delete()
      .eq("item_id", itemId)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);

    revalidatePath("/food-tent");
    revalidatePath("/");
  });
}

export async function addWishlistItem(formData: FormData) {
  return tryAction(async () => {
    const supabase = await createClient();
    const { user } = await requireManager(supabase);

    const title = String(formData.get("title") ?? "").trim();
    const quantityRaw = String(formData.get("quantity_needed") ?? "1").trim();
    const quantityNeeded = Math.max(1, Number(quantityRaw) || 1);
    const notes = String(formData.get("notes") ?? "").trim() || null;

    if (!title) {
      throw new UserError("Item name is required.");
    }

    const { error } = await supabase.from("food_tent_wishlist_items").insert({
      title,
      quantity_needed: quantityNeeded,
      notes,
      created_by: user.id,
    });

    if (error) throw new Error(error.message);

    revalidatePath("/food-tent");
  });
}

export async function updateWishlistItem(formData: FormData) {
  return tryAction(async () => {
    const supabase = await createClient();
    await requireManager(supabase);

    const itemId = String(formData.get("item_id") ?? "").trim();
    const title = String(formData.get("title") ?? "").trim();
    const quantityRaw = String(formData.get("quantity_needed") ?? "1").trim();
    const quantityNeeded = Math.max(1, Number(quantityRaw) || 1);
    const notes = String(formData.get("notes") ?? "").trim() || null;

    if (!itemId || !title) {
      throw new UserError("Item name is required.");
    }

    const { error } = await supabase
      .from("food_tent_wishlist_items")
      .update({ title, quantity_needed: quantityNeeded, notes })
      .eq("id", itemId);

    if (error) throw new Error(error.message);

    revalidatePath("/food-tent");
  });
}

export async function deleteWishlistItem(itemId: string) {
  const supabase = await createClient();
  await requireManager(supabase);

  const { error } = await supabase.from("food_tent_wishlist_items").delete().eq("id", itemId);
  if (error) throw new Error(error.message);

  revalidatePath("/food-tent");
}

export async function signUpForWishlistItem(formData: FormData) {
  return tryAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UserError("Not signed in.");

    const itemId = String(formData.get("item_id") ?? "").trim();
    const quantityRaw = String(formData.get("quantity") ?? "1").trim();
    const quantity = Math.max(1, Number(quantityRaw) || 1);

    if (!itemId) throw new UserError("Missing item.");

    const { error } = await supabase
      .from("food_tent_wishlist_signups")
      .upsert({ item_id: itemId, user_id: user.id, quantity }, { onConflict: "item_id,user_id" });

    if (error) throw new Error(error.message);

    revalidatePath("/food-tent");
  });
}

export async function cancelWishlistSignup(formData: FormData) {
  return tryAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UserError("Not signed in.");

    const itemId = String(formData.get("item_id") ?? "").trim();
    if (!itemId) throw new UserError("Missing item.");

    const { error } = await supabase
      .from("food_tent_wishlist_signups")
      .delete()
      .eq("item_id", itemId)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);

    revalidatePath("/food-tent");
  });
}

// "No food tent at this regatta" (0118): no draft list, food alerts,
// banners or reminders for it. Tent leaders can't edit the schedule, so
// this one column is changed with the service role after the check above.
export async function setHasFoodTent(eventId: string, hasFoodTent: boolean) {
  return tryAction(async () => {
    const supabase = await createClient();
    await requireManager(supabase);
    const clubId = await myClubId();
    const { error } = await createAdminClient()
      .from("schedule_events")
      .update({ has_food_tent: hasFoodTent })
      .eq("id", eventId)
      .eq("club_id", clubId)
      .eq("event_type", "regatta");
    if (error) throw new Error(error.message);
    revalidatePath("/food-tent");
    revalidatePath("/");
  });
}

// A banner message from the food tent (0118), to families or everyone,
// optionally about one regatta (it then disappears after that regatta).
export async function postFoodTentMessage(formData: FormData) {
  return tryAction(async () => {
    const supabase = await createClient();
    const { user } = await requireManager(supabase);
    const message = String(formData.get("message") ?? "").trim().slice(0, 1000);
    if (!message) throw new UserError("Write a message first.");
    const audience = formData.get("audience") === "everyone" ? "everyone" : "families";
    const eventId = String(formData.get("event_id") ?? "") || null;
    const alert = formData.get("alert") === "on";

    const { error } = await supabase
      .from("food_tent_messages")
      .insert({ sender_id: user.id, message, audience, event_id: eventId });
    if (error) throw new Error(error.message);

    revalidatePath("/food-tent");
    revalidatePath("/");

    if (alert) {
      after(async () => {
        const clubId = await myClubId();
        const ids = audience === "everyone" ? await activeMemberIds(clubId) : await familyMemberIds(clubId);
        await sendPush(
          ids.filter((id) => id !== user.id),
          {
            kind: "food_message",
            title: "Food tent",
            body: message.length > 140 ? `${message.slice(0, 139)}…` : message,
            url: "/",
          }
        );
      });
    }
  });
}

export async function deleteFoodTentMessage(messageId: string) {
  return tryAction(async () => {
    const supabase = await createClient();
    await requireManager(supabase);
    const { error } = await supabase.from("food_tent_messages").delete().eq("id", messageId);
    if (error) throw new Error(error.message);
    revalidatePath("/food-tent");
    revalidatePath("/");
  });
}
