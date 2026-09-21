"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { BOAT_CLASSES } from "@/lib/boatClasses";
import { LINEUP_CATEGORY_OPTIONS } from "@/lib/lineupCategories";
import type { LineupCategory } from "@/lib/database.types";

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

  const callerRole = (callerProfile as { role: string } | null)?.role;
  if (callerRole !== "admin" && callerRole !== "coach") {
    throw new Error("Only coaches and admins can manage lineups.");
  }

  return { user };
}

export async function createBoat(formData: FormData) {
  const supabase = await createClient();
  const { user } = await requireManager(supabase);

  const name = String(formData.get("name") ?? "").trim();
  const boatClass = String(formData.get("boat_class") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!name || !BOAT_CLASSES[boatClass]) {
    throw new Error("Boat name and a valid boat class are required.");
  }

  const { error } = await supabase
    .from("boats")
    .insert({ name, boat_class: boatClass, notes, created_by: user.id });

  if (error) throw new Error(error.message);

  revalidatePath("/lineups");
}

export async function updateBoat(formData: FormData) {
  const supabase = await createClient();
  await requireManager(supabase);

  const boatId = String(formData.get("boat_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const boatClass = String(formData.get("boat_class") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!boatId || !name || !BOAT_CLASSES[boatClass]) {
    throw new Error("Boat name and a valid boat class are required.");
  }

  const { error } = await supabase
    .from("boats")
    .update({ name, boat_class: boatClass, notes })
    .eq("id", boatId);

  if (error) throw new Error(error.message);

  revalidatePath("/lineups");
}

export async function deleteBoat(formData: FormData) {
  const supabase = await createClient();
  await requireManager(supabase);

  const boatId = String(formData.get("boat_id") ?? "").trim();
  if (!boatId) throw new Error("Missing boat.");

  const { error } = await supabase.from("boats").delete().eq("id", boatId);
  if (error) throw new Error(error.message);

  revalidatePath("/lineups");
}

export async function createLineup(formData: FormData) {
  const supabase = await createClient();
  const { user } = await requireManager(supabase);

  const eventId = String(formData.get("event_id") ?? "").trim();
  const boatId = String(formData.get("boat_id") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!eventId || !boatId) {
    throw new Error("Please choose a boat.");
  }
  if (!LINEUP_CATEGORY_OPTIONS.includes(category)) {
    throw new Error("Please choose a category.");
  }

  const { data: boat, error: boatError } = await supabase
    .from("boats")
    .select("name, boat_class")
    .eq("id", boatId)
    .single();
  if (boatError || !boat) throw new Error("That boat couldn't be found.");

  const classSpec = BOAT_CLASSES[boat.boat_class];
  if (!classSpec) throw new Error(`Unknown boat class "${boat.boat_class}".`);

  const { data: lineup, error } = await supabase
    .from("lineups")
    .insert({
      event_id: eventId,
      boat_id: boatId,
      boat_name: boat.name,
      boat_class: boat.boat_class,
      category: category as LineupCategory,
      notes,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  const seats: { lineup_id: string; seat_number: number; seat_role: "rower" | "coxswain" }[] =
    Array.from({ length: classSpec.rowerSeats }, (_, i) => ({
      lineup_id: lineup.id,
      seat_number: i + 1,
      seat_role: "rower",
    }));
  if (classSpec.hasCoxswain) {
    seats.push({
      lineup_id: lineup.id,
      seat_number: classSpec.rowerSeats + 1,
      seat_role: "coxswain" as const,
    });
  }

  const { error: seatsError } = await supabase.from("lineup_seats").insert(seats);
  if (seatsError) throw new Error(seatsError.message);

  revalidatePath("/lineups");
}

export async function deleteLineup(formData: FormData) {
  const supabase = await createClient();
  await requireManager(supabase);

  const lineupId = String(formData.get("lineup_id") ?? "").trim();
  if (!lineupId) throw new Error("Missing boat.");

  const { error } = await supabase.from("lineups").delete().eq("id", lineupId);
  if (error) throw new Error(error.message);

  revalidatePath("/lineups");
}

export async function assignSeat(seatId: string, rowerId: string | null) {
  const supabase = await createClient();
  await requireManager(supabase);

  const { error } = await supabase
    .from("lineup_seats")
    .update({ rower_id: rowerId })
    .eq("id", seatId);

  if (error) throw new Error(error.message);

  revalidatePath("/lineups");
}
