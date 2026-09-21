"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { BOAT_CLASSES, BOAT_CLASS_OPTIONS } from "@/lib/boatClasses";
import {
  LINEUP_CATEGORIES,
  LINEUP_CATEGORY_OPTIONS,
  FLEET_CATEGORY_OPTIONS,
  CATEGORY_BOAT_CLASS,
} from "@/lib/lineupCategories";
import type { LineupCategory } from "@/lib/database.types";

function seatsForBoatClass(boatClass: string): { seat_number: number; seat_role: "rower" | "coxswain" }[] {
  const classSpec = BOAT_CLASSES[boatClass];
  if (!classSpec) throw new Error(`Unknown boat class "${boatClass}".`);

  const seats: { seat_number: number; seat_role: "rower" | "coxswain" }[] = Array.from(
    { length: classSpec.rowerSeats },
    (_, i) => ({ seat_number: i + 1, seat_role: "rower" })
  );
  if (classSpec.hasCoxswain) {
    seats.push({ seat_number: classSpec.rowerSeats + 1, seat_role: "coxswain" });
  }
  return seats;
}

// A boat's "type" is either a Men's/Women's depth category (which also
// pins down its boat class) or, for boats out of that scheme (1x/2x/2-), a
// raw boat class. Both are offered from the same <select> in BoatsSection.
function resolveBoatType(boatType: string): { category: LineupCategory | null; boatClass: string } {
  if (FLEET_CATEGORY_OPTIONS.includes(boatType)) {
    return { category: boatType as LineupCategory, boatClass: CATEGORY_BOAT_CLASS[boatType] };
  }
  if (BOAT_CLASSES[boatType]) {
    return { category: null, boatClass: boatType };
  }
  throw new Error("Please choose a valid boat type.");
}

function isUniqueViolation(error: { code?: string }): boolean {
  return error.code === "23505";
}

// A fleet boat's crew: seats copied from its linked saved template (if any),
// falling back to an empty roster sized for its boat class. Also surfaces
// the template's category/notes so a race-lineup can inherit them.
async function boatLineupDefaults(
  supabase: Awaited<ReturnType<typeof createClient>>,
  boatId: string,
  boatClass: string
): Promise<{
  category: LineupCategory | null;
  notes: string | null;
  seats: { seat_number: number; seat_role: "rower" | "coxswain" | "coach"; rower_id: string | null }[];
}> {
  const { data: template } = await supabase
    .from("lineup_templates")
    .select("id, category, notes")
    .eq("boat_id", boatId)
    .maybeSingle();

  if (template) {
    const { data: templateSeats, error } = await supabase
      .from("lineup_template_seats")
      .select("seat_number, seat_role, rower_id")
      .eq("template_id", template.id);
    if (error) throw new Error(error.message);
    if (templateSeats && templateSeats.length > 0) {
      return { category: template.category, notes: template.notes, seats: templateSeats };
    }
  }

  return {
    category: null,
    notes: null,
    seats: seatsForBoatClass(boatClass).map((s) => ({ ...s, rower_id: null })),
  };
}

// Creates the saved crew a fleet boat carries once it's given a category —
// an empty-seat lineup_templates row linked 1:1 to the boat.
async function createLinkedTemplate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  {
    boatId,
    boatClass,
    category,
    userId,
  }: { boatId: string; boatClass: string; category: LineupCategory; userId: string }
) {
  const seats = seatsForBoatClass(boatClass);
  const templateId = crypto.randomUUID();
  const { error } = await supabase.from("lineup_templates").insert({
    id: templateId,
    name: LINEUP_CATEGORIES[category] ?? category,
    boat_class: boatClass,
    boat_id: boatId,
    category,
    created_by: userId,
  });
  if (error) throw new Error(error.message);

  const { error: seatsError } = await supabase
    .from("lineup_template_seats")
    .insert(seats.map((s) => ({ ...s, template_id: templateId })));
  if (seatsError) throw new Error(seatsError.message);
}

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
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!name) throw new Error("Boat name is required.");

  const { category, boatClass } = resolveBoatType(String(formData.get("boat_type") ?? "").trim());

  const boatId = crypto.randomUUID();
  const { error } = await supabase
    .from("boats")
    .insert({ id: boatId, name, boat_class: boatClass, category, notes, created_by: user.id });

  if (error) throw new Error(error.message);

  if (category) {
    await createLinkedTemplate(supabase, { boatId, boatClass, category, userId: user.id });
  }

  revalidatePath("/lineups");
}

export interface BoatImportRow {
  name?: string;
  boat_class?: string;
  notes?: string;
}

export async function importBoats(rows: BoatImportRow[]) {
  const supabase = await createClient();
  const { user } = await requireManager(supabase);

  const toUpsert: { name: string; boat_class: string; notes: string | null; created_by: string }[] =
    [];
  const rowErrors: string[] = [];

  rows.forEach((row, i) => {
    const rowLabel = `Row ${i + 2}`; // +2: header row + 1-index
    const name = String(row.name ?? "").trim();
    const boatClassRaw = String(row.boat_class ?? "").trim();
    const boatClass = BOAT_CLASS_OPTIONS.find(
      (cls) => cls.toLowerCase() === boatClassRaw.toLowerCase()
    );

    if (!name) {
      rowErrors.push(`${rowLabel}: missing boat name.`);
      return;
    }
    if (!boatClass) {
      rowErrors.push(
        `${rowLabel}: unknown boat class "${row.boat_class ?? ""}". Expected one of ${BOAT_CLASS_OPTIONS.join(", ")}.`
      );
      return;
    }

    toUpsert.push({
      name,
      boat_class: boatClass,
      notes: String(row.notes ?? "").trim() || null,
      created_by: user.id,
    });
  });

  if (toUpsert.length === 0) {
    return { imported: 0, errors: rowErrors.length ? rowErrors : ["No valid rows found."] };
  }

  // Upsert by name: re-running an import (e.g. an updated spreadsheet) syncs
  // class/notes for existing boats instead of failing on the unique name.
  const { error, data } = await supabase
    .from("boats")
    .upsert(toUpsert, { onConflict: "name" })
    .select("id");

  if (error) throw new Error(error.message);

  revalidatePath("/lineups");
  revalidatePath("/boat-maintenance");
  return { imported: data?.length ?? 0, errors: rowErrors };
}

export async function updateBoat(formData: FormData) {
  const supabase = await createClient();
  const { user } = await requireManager(supabase);

  const boatId = String(formData.get("boat_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!boatId || !name) throw new Error("Boat name is required.");

  const { category, boatClass } = resolveBoatType(String(formData.get("boat_type") ?? "").trim());

  const { error } = await supabase
    .from("boats")
    .update({ name, boat_class: boatClass, category, notes })
    .eq("id", boatId);

  if (error) throw new Error(error.message);

  if (category) {
    const { data: existingTemplate } = await supabase
      .from("lineup_templates")
      .select("id")
      .eq("boat_id", boatId)
      .maybeSingle();

    if (existingTemplate) {
      await supabase
        .from("lineup_templates")
        .update({ boat_class: boatClass, category })
        .eq("id", existingTemplate.id);
    } else {
      await createLinkedTemplate(supabase, { boatId, boatClass, category, userId: user.id });
    }
  }

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
  const raceName = String(formData.get("race_name") ?? "").trim() || null;
  const raceTimeRaw = String(formData.get("race_time") ?? "").trim();
  const raceTime = raceTimeRaw ? new Date(raceTimeRaw).toISOString() : null;

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

  const { seats } = await boatLineupDefaults(supabase, boatId, boat.boat_class);

  const lineupId = crypto.randomUUID();
  const { error } = await supabase.from("lineups").insert({
    id: lineupId,
    event_id: eventId,
    boat_id: boatId,
    boat_name: boat.name,
    boat_class: boat.boat_class,
    category: category as LineupCategory,
    notes,
    race_name: raceName,
    race_time: raceTime,
    created_by: user.id,
  });

  if (error) throw new Error(error.message);

  const { error: seatsError } = await supabase
    .from("lineup_seats")
    .insert(seats.map((s) => ({ ...s, lineup_id: lineupId })));
  if (seatsError) throw new Error(seatsError.message);

  revalidatePath("/lineups");
}

export interface RaceImportRow {
  race_name?: string;
  category?: string;
  race_time?: string;
}

export async function importRaces(eventId: string, rows: RaceImportRow[]) {
  const supabase = await createClient();
  const { user } = await requireManager(supabase);

  if (!eventId) throw new Error("Missing event.");

  const toInsert: {
    event_id: string;
    race_name: string;
    category: LineupCategory | null;
    race_time: string | null;
    created_by: string;
  }[] = [];
  const rowErrors: string[] = [];

  rows.forEach((row, i) => {
    const rowLabel = `Row ${i + 2}`; // +2: header row + 1-index
    const raceName = String(row.race_name ?? "").trim();
    if (!raceName) {
      rowErrors.push(`${rowLabel}: missing race name.`);
      return;
    }

    const categoryRaw = String(row.category ?? "").trim().toLowerCase().replace(/\s+/g, "_");
    let category: LineupCategory | null = null;
    if (categoryRaw) {
      const match = LINEUP_CATEGORY_OPTIONS.find(
        (c) => c === categoryRaw || LINEUP_CATEGORIES[c].toLowerCase() === categoryRaw.replace(/_/g, " ")
      );
      if (!match) {
        rowErrors.push(`${rowLabel}: unrecognized category "${row.category}", left uncategorized.`);
      } else {
        category = match as LineupCategory;
      }
    }

    const raceTimeRaw = String(row.race_time ?? "").trim();
    const raceTime = raceTimeRaw && !isNaN(Date.parse(raceTimeRaw)) ? new Date(raceTimeRaw).toISOString() : null;
    if (raceTimeRaw && !raceTime) {
      rowErrors.push(`${rowLabel}: couldn't read race time "${row.race_time}", left blank.`);
    }

    toInsert.push({ event_id: eventId, race_name: raceName, category, race_time: raceTime, created_by: user.id });
  });

  if (toInsert.length === 0) {
    return { imported: 0, errors: rowErrors.length ? rowErrors : ["No valid rows found."] };
  }

  const { error, data } = await supabase.from("races").insert(toInsert).select("id");
  if (error) throw new Error(error.message);

  revalidatePath("/lineups");
  revalidatePath("/");
  return { imported: data?.length ?? 0, errors: rowErrors };
}

export async function deleteRace(formData: FormData) {
  const supabase = await createClient();
  await requireManager(supabase);

  const raceId = String(formData.get("race_id") ?? "").trim();
  if (!raceId) throw new Error("Missing race.");

  const { error } = await supabase.from("races").delete().eq("id", raceId);
  if (error) throw new Error(error.message);

  revalidatePath("/lineups");
  revalidatePath("/");
}

// Builds a fresh lineup from scratch for a specific pending race, pulling
// category/race_name/race_time from the race itself rather than asking the
// coach to re-enter them, and marks the race as no longer pending.
export async function createLineupForRace(formData: FormData) {
  const supabase = await createClient();
  const { user } = await requireManager(supabase);

  const raceId = String(formData.get("race_id") ?? "").trim();
  const boatId = String(formData.get("boat_id") ?? "").trim();
  if (!raceId || !boatId) throw new Error("Please choose a boat.");

  const { data: race, error: raceError } = await supabase
    .from("races")
    .select("event_id, category, race_name, race_time, lineup_id")
    .eq("id", raceId)
    .single();
  if (raceError || !race) throw new Error("That race couldn't be found.");
  if (race.lineup_id) throw new Error("This race already has a lineup.");

  const { data: boat, error: boatError } = await supabase
    .from("boats")
    .select("name, boat_class")
    .eq("id", boatId)
    .single();
  if (boatError || !boat) throw new Error("That boat couldn't be found.");

  const seats = seatsForBoatClass(boat.boat_class);

  const lineupId = crypto.randomUUID();
  const { error } = await supabase.from("lineups").insert({
    id: lineupId,
    event_id: race.event_id,
    boat_id: boatId,
    boat_name: boat.name,
    boat_class: boat.boat_class,
    category: race.category,
    race_name: race.race_name,
    race_time: race.race_time,
    created_by: user.id,
  });
  if (error) throw new Error(error.message);

  const { error: seatsError } = await supabase
    .from("lineup_seats")
    .insert(seats.map((s) => ({ ...s, lineup_id: lineupId })));
  if (seatsError) throw new Error(seatsError.message);

  const { error: raceUpdateError } = await supabase
    .from("races")
    .update({ lineup_id: lineupId })
    .eq("id", raceId);
  if (raceUpdateError) throw new Error(raceUpdateError.message);

  revalidatePath("/lineups");
  revalidatePath("/");
}

export async function createLineupTemplate(formData: FormData) {
  const supabase = await createClient();
  const { user } = await requireManager(supabase);

  const name = String(formData.get("name") ?? "").trim();
  const boatClass = String(formData.get("boat_class") ?? "").trim();
  const boatId = String(formData.get("boat_id") ?? "").trim() || null;
  const categoryRaw = String(formData.get("category") ?? "").trim();
  const category = LINEUP_CATEGORY_OPTIONS.includes(categoryRaw) ? (categoryRaw as LineupCategory) : null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!name || !BOAT_CLASSES[boatClass]) {
    throw new Error("Name and a valid boat class are required.");
  }

  if (boatId) {
    const { data: boat, error: boatError } = await supabase
      .from("boats")
      .select("boat_class")
      .eq("id", boatId)
      .single();
    if (boatError || !boat) throw new Error("That boat couldn't be found.");
    if (boat.boat_class !== boatClass) {
      throw new Error("The default boat's class doesn't match the template's boat class.");
    }
  }

  const seats = seatsForBoatClass(boatClass);

  const templateId = crypto.randomUUID();
  const { error } = await supabase.from("lineup_templates").insert({
    id: templateId,
    name,
    boat_class: boatClass,
    boat_id: boatId,
    category,
    notes,
    created_by: user.id,
  });
  if (error) throw new Error(error.message);

  const { error: seatsError } = await supabase
    .from("lineup_template_seats")
    .insert(seats.map((s) => ({ ...s, template_id: templateId })));
  if (seatsError) throw new Error(seatsError.message);

  revalidatePath("/lineups");
}

export async function updateTemplateBoat(formData: FormData) {
  const supabase = await createClient();
  await requireManager(supabase);

  const templateId = String(formData.get("template_id") ?? "").trim();
  const boatId = String(formData.get("boat_id") ?? "").trim() || null;
  if (!templateId) throw new Error("Missing template.");

  if (boatId) {
    const [{ data: template, error: templateError }, { data: boat, error: boatError }] = await Promise.all([
      supabase.from("lineup_templates").select("boat_class").eq("id", templateId).single(),
      supabase.from("boats").select("boat_class").eq("id", boatId).single(),
    ]);
    if (templateError || !template) throw new Error("That template couldn't be found.");
    if (boatError || !boat) throw new Error("That boat couldn't be found.");
    if (boat.boat_class !== template.boat_class) {
      throw new Error("That boat's class doesn't match this template's boat class.");
    }
  }

  const { error } = await supabase
    .from("lineup_templates")
    .update({ boat_id: boatId })
    .eq("id", templateId);
  if (error) throw new Error(error.message);

  revalidatePath("/lineups");
}

export async function deleteLineupTemplate(templateId: string) {
  const supabase = await createClient();
  await requireManager(supabase);

  const { error } = await supabase.from("lineup_templates").delete().eq("id", templateId);
  if (error) throw new Error(error.message);

  revalidatePath("/lineups");
}

export async function assignTemplateSeat(seatId: string, rowerId: string | null) {
  const supabase = await createClient();
  await requireManager(supabase);

  const { error } = await supabase
    .from("lineup_template_seats")
    .update({ rower_id: rowerId })
    .eq("id", seatId);

  if (error) throw new Error(error.message);

  revalidatePath("/lineups");
}

// Applies a saved lineup template to a pending race: picks a boat (must
// match the template's boat class, since that determines seat count),
// creates a real lineup with the template's crew pre-filled, and marks the
// race as no longer pending. The new lineup is an independent copy — later
// edits to the template, or to this lineup's seats, don't affect each other.
export async function applyTemplateToRace(formData: FormData) {
  const supabase = await createClient();
  const { user } = await requireManager(supabase);

  const raceId = String(formData.get("race_id") ?? "").trim();
  const templateId = String(formData.get("template_id") ?? "").trim();
  const boatId = String(formData.get("boat_id") ?? "").trim();
  if (!raceId || !templateId || !boatId) {
    throw new Error("Please choose a template and a boat.");
  }

  const { data: race, error: raceError } = await supabase
    .from("races")
    .select("event_id, category, race_name, race_time, lineup_id")
    .eq("id", raceId)
    .single();
  if (raceError || !race) throw new Error("That race couldn't be found.");
  if (race.lineup_id) throw new Error("This race already has a lineup.");

  const { data: template, error: templateError } = await supabase
    .from("lineup_templates")
    .select("name, boat_class, category, notes")
    .eq("id", templateId)
    .single();
  if (templateError || !template) throw new Error("That template couldn't be found.");

  const { data: boat, error: boatError } = await supabase
    .from("boats")
    .select("name, boat_class")
    .eq("id", boatId)
    .single();
  if (boatError || !boat) throw new Error("That boat couldn't be found.");

  if (boat.boat_class !== template.boat_class) {
    throw new Error(
      `${template.name} needs a ${BOAT_CLASSES[template.boat_class]?.label ?? template.boat_class} boat.`
    );
  }

  const { data: templateSeats, error: templateSeatsError } = await supabase
    .from("lineup_template_seats")
    .select("seat_number, seat_role, rower_id")
    .eq("template_id", templateId);
  if (templateSeatsError) throw new Error(templateSeatsError.message);

  const lineupId = crypto.randomUUID();
  const { error } = await supabase.from("lineups").insert({
    id: lineupId,
    event_id: race.event_id,
    boat_id: boatId,
    boat_name: boat.name,
    boat_class: boat.boat_class,
    category: template.category ?? race.category,
    notes: template.notes,
    race_name: race.race_name,
    race_time: race.race_time,
    created_by: user.id,
  });
  if (error) throw new Error(error.message);

  const { error: seatsError } = await supabase.from("lineup_seats").insert(
    (templateSeats ?? []).map((s) => ({
      lineup_id: lineupId,
      seat_number: s.seat_number,
      seat_role: s.seat_role,
      rower_id: s.rower_id,
    }))
  );
  if (seatsError) throw new Error(seatsError.message);

  const { error: raceUpdateError } = await supabase
    .from("races")
    .update({ lineup_id: lineupId })
    .eq("id", raceId);
  if (raceUpdateError) throw new Error(raceUpdateError.message);

  revalidatePath("/lineups");
  revalidatePath("/");
}

export async function updateLineupRace(formData: FormData) {
  const supabase = await createClient();
  await requireManager(supabase);

  const lineupId = String(formData.get("lineup_id") ?? "").trim();
  if (!lineupId) throw new Error("Missing boat.");

  const raceName = String(formData.get("race_name") ?? "").trim() || null;
  const raceTimeRaw = String(formData.get("race_time") ?? "").trim();
  const raceTime = raceTimeRaw ? new Date(raceTimeRaw).toISOString() : null;

  const { error } = await supabase
    .from("lineups")
    .update({ race_name: raceName, race_time: raceTime })
    .eq("id", lineupId);

  if (error) throw new Error(error.message);

  revalidatePath("/lineups");
  revalidatePath("/");
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
