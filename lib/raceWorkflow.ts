import "server-only";
import { createClient } from "@/lib/supabase/server";
import { BOAT_CLASSES } from "@/lib/boatClasses";
import {
  LINEUP_CATEGORIES,
  FLEET_CATEGORY_OPTIONS,
  CATEGORY_BOAT_CLASS,
} from "@/lib/lineupCategories";
import type { LineupCategory } from "@/lib/database.types";

// The shared steps behind getting races and boats onto a regatta, used by
// the Lineups actions and the Head of the Cuyahoga page alike so every path
// (feed, Excel, pasted list, single race) behaves the same way.

export type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export function seatsForBoatClass(boatClass: string): { seat_number: number; seat_role: "rower" | "coxswain" }[] {
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
export function resolveBoatType(boatType: string): { category: LineupCategory | null; boatClass: string } {
  if (FLEET_CATEGORY_OPTIONS.includes(boatType)) {
    return { category: boatType as LineupCategory, boatClass: CATEGORY_BOAT_CLASS[boatType] };
  }
  if (BOAT_CLASSES[boatType]) {
    return { category: null, boatClass: boatType };
  }
  throw new Error("Please choose a valid boat type.");
}

export function isUniqueViolation(error: { code?: string }): boolean {
  return error.code === "23505";
}

// A fleet boat's crew: seats copied from its linked saved template (if any),
// falling back to an empty roster sized for its boat class. Also surfaces
// the template's category/notes so a race-lineup can inherit them.
export async function boatLineupDefaults(
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
export async function createLinkedTemplate(
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

// A boat or a race needs a Launch and Recovery task without the coach
// having to add them by hand every time — best-effort: a missing
// Launch/Recovery task type (e.g. renamed or deleted) shouldn't block the
// lineup/race itself from being created.
export async function createLaunchRecoveryTasks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  {
    eventId,
    userId,
    lineupId = null,
    raceId = null,
  }: { eventId: string; userId: string; lineupId?: string | null; raceId?: string | null }
) {
  const { data: typesData } = await supabase
    .from("task_types")
    .select("id")
    .in("name", ["Launch", "Recovery"]);
  const types = (typesData as { id: string }[] | null) ?? [];
  if (types.length === 0) return;

  const { error } = await supabase.from("coach_tasks").insert(
    types.map((t) => ({
      event_id: eventId,
      task_type_id: t.id,
      lineup_id: lineupId,
      race_id: raceId,
      created_by: userId,
    }))
  );
  if (error && !isUniqueViolation(error)) {
    console.error("Failed to auto-create launch/recovery tasks:", error.message);
  }
}

// Bulk variant of createLaunchRecoveryTasks for importRaces, which can add
// many races at once — one task_types lookup and one insert instead of N.
export async function createLaunchRecoveryTasksForRaces(
  supabase: Awaited<ReturnType<typeof createClient>>,
  { eventId, userId, raceIds }: { eventId: string; userId: string; raceIds: string[] }
) {
  if (raceIds.length === 0) return;

  const { data: typesData } = await supabase
    .from("task_types")
    .select("id")
    .in("name", ["Launch", "Recovery"]);
  const types = (typesData as { id: string }[] | null) ?? [];
  if (types.length === 0) return;

  const { error } = await supabase.from("coach_tasks").insert(
    raceIds.flatMap((raceId) =>
      types.map((t) => ({
        event_id: eventId,
        task_type_id: t.id,
        race_id: raceId,
        created_by: userId,
      }))
    )
  );
  if (error && !isUniqueViolation(error)) {
    console.error("Failed to auto-create launch/recovery tasks for imported races:", error.message);
  }
}

// A pending race often gets its own Launch/Recovery tasks the moment it's
// added to the schedule (before any boat is assigned — see
// ensureRaceLaunchRecoveryTasks in importRaces below). Once a boat IS
// assigned, re-point those same tasks at the new lineup instead of creating
// a duplicate pair, so "Launch — boat TBD" just becomes "Launch — Chase".
// Falls back to creating a fresh lineup-tied pair if the race never got
// tasks in the first place.
export async function linkOrCreateLaunchRecoveryTasksForLineup(
  supabase: Awaited<ReturnType<typeof createClient>>,
  {
    raceId,
    lineupId,
    eventId,
    userId,
  }: { raceId: string | null; lineupId: string; eventId: string; userId: string }
) {
  if (raceId) {
    const { data: linked, error } = await supabase
      .from("coach_tasks")
      .update({ lineup_id: lineupId })
      .eq("race_id", raceId)
      .select("id");
    if (error) {
      console.error("Failed to link race tasks to lineup:", error.message);
    } else if ((linked?.length ?? 0) > 0) {
      return;
    }
  }
  await createLaunchRecoveryTasks(supabase, { eventId, userId, lineupId });
}

