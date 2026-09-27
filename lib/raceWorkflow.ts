import "server-only";
import { createClient } from "@/lib/supabase/server";
import { BOAT_CLASSES } from "@/lib/boatClasses";
import {
  LINEUP_CATEGORIES,
  FLEET_CATEGORY_OPTIONS,
  CATEGORY_BOAT_CLASS,
  categoryForRace,
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


export interface NewRace {
  race_name: string;
  category?: string | null;
  race_time?: string | null;
}

// Adds races to a regatta in one go, for the given club (null = any club):
// skips any whose name that club already has on it (so re-running an import
// or re-tapping "Add all" only adds what's new),
// applies the Masters rule, gives each one its Launch/Recovery tasks, and
// puts a boat in any race only one fleet boat fits.
export async function insertRaces(
  supabase: SupabaseServerClient,
  {
    eventId,
    userId,
    races,
    clubSlug = null,
  }: { eventId: string; userId: string; races: NewRace[]; clubSlug?: string | null }
): Promise<{ raceIds: string[] }> {
  const existingQuery = supabase.from("races").select("race_name").eq("event_id", eventId);
  const { data: existingData } = await (clubSlug
    ? existingQuery.eq("club_slug", clubSlug)
    : existingQuery.is("club_slug", null));
  const existingNames = new Set(((existingData as { race_name: string }[] | null) ?? []).map((r) => r.race_name));

  const seen = new Set<string>();
  const toInsert = races.filter((r) => {
    if (existingNames.has(r.race_name) || seen.has(r.race_name)) return false;
    seen.add(r.race_name);
    return true;
  });
  if (toInsert.length === 0) return { raceIds: [] };

  const { data, error } = await supabase
    .from("races")
    .insert(
      toInsert.map((r) => ({
        event_id: eventId,
        race_name: r.race_name,
        category: categoryForRace(r.race_name, r.category ?? null) as LineupCategory | null,
        race_time: r.race_time ?? null,
        club_slug: clubSlug,
        created_by: userId,
      }))
    )
    .select("id");
  if (error) throw new Error(error.message);

  const raceIds = ((data as { id: string }[] | null) ?? []).map((r) => r.id);
  await createLaunchRecoveryTasksForRaces(supabase, { eventId, userId, raceIds });
  await autoAssignBoats(supabase, { raceIds, userId });
  return { raceIds };
}

// A race whose category (e.g. Masters 1V8) matches exactly one fleet boat
// gets that boat, and its saved crew, straight away — no choice to make.
// Left pending for a coach instead when there's no category, several boats
// match, or the boat would be in two races at once (two crews in the same
// category at the same time, or the boat already racing then). Best-effort:
// a failure here leaves the race pending rather than failing the import.
async function autoAssignBoats(
  supabase: SupabaseServerClient,
  { raceIds, userId }: { raceIds: string[]; userId: string }
) {
  if (raceIds.length === 0) return;
  const { data: raceRows } = await supabase
    .from("races")
    .select("id, event_id, category, race_time")
    .in("id", raceIds);
  const races = (
    (raceRows as { id: string; event_id: string; category: string | null; race_time: string | null }[] | null) ?? []
  ).filter((r) => r.category && r.category in CATEGORY_BOAT_CLASS);
  if (races.length === 0) return;

  const { data: boatRows } = await supabase
    .from("boats")
    .select("id, category")
    .in("category", [...new Set(races.map((r) => r.category as string))]);
  const boatIdsByCategory = new Map<string, string[]>();
  for (const b of (boatRows as { id: string; category: string }[] | null) ?? []) {
    boatIdsByCategory.set(b.category, [...(boatIdsByCategory.get(b.category) ?? []), b.id]);
  }

  // When each boat is already racing at these regattas.
  const { data: busyRows } = await supabase
    .from("lineups")
    .select("boat_id, race_time")
    .in("event_id", [...new Set(races.map((r) => r.event_id))])
    .not("race_time", "is", null);
  const busy = new Set(
    ((busyRows as { boat_id: string | null; race_time: string }[] | null) ?? []).map(
      (l) => `${l.boat_id}@${new Date(l.race_time).getTime()}`
    )
  );
  const slotKey = (r: { category: string | null; race_time: string | null }) =>
    `${r.category}@${r.race_time ? new Date(r.race_time).getTime() : "any"}`;
  const racesPerSlot = new Map<string, number>();
  for (const r of races) racesPerSlot.set(slotKey(r), (racesPerSlot.get(slotKey(r)) ?? 0) + 1);

  for (const race of races) {
    const boatIds = boatIdsByCategory.get(race.category as string) ?? [];
    if (boatIds.length !== 1 || (racesPerSlot.get(slotKey(race)) ?? 0) > 1) continue;
    if (race.race_time && busy.has(`${boatIds[0]}@${new Date(race.race_time).getTime()}`)) continue;
    try {
      await buildLineupForRace(supabase, { raceId: race.id, boatId: boatIds[0], userId });
      if (race.race_time) busy.add(`${boatIds[0]}@${new Date(race.race_time).getTime()}`);
    } catch (e) {
      console.error("Couldn't auto-assign a boat to race", race.id, e);
    }
  }
}

// Builds a lineup for a pending race from a fleet boat: race name/time from
// the race, category/notes/crew from the boat's saved crew when it has one
// (else the race's own category and an empty roster), then marks the race
// as no longer pending and points its Launch/Recovery tasks at the boat.
export async function buildLineupForRace(
  supabase: SupabaseServerClient,
  { raceId, boatId, userId }: { raceId: string; boatId: string; userId: string }
): Promise<string> {
  const { data: race, error: raceError } = await supabase
    .from("races")
    .select("event_id, category, race_name, race_time, lineup_id, club_slug")
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

  const { category: templateCategory, notes: templateNotes, seats } = await boatLineupDefaults(
    supabase,
    boatId,
    boat.boat_class
  );

  const lineupId = crypto.randomUUID();
  const { error } = await supabase.from("lineups").insert({
    id: lineupId,
    event_id: race.event_id,
    boat_id: boatId,
    boat_name: boat.name,
    boat_class: boat.boat_class,
    category: categoryForRace(race.race_name, templateCategory ?? race.category) as LineupCategory | null,
    notes: templateNotes,
    race_name: race.race_name,
    race_time: race.race_time,
    club_slug: race.club_slug,
    created_by: userId,
  });
  if (error) throw new Error(error.message);

  const { error: seatsError } = await supabase
    .from("lineup_seats")
    .insert(seats.map((s) => ({ ...s, lineup_id: lineupId })));
  if (seatsError) throw new Error(seatsError.message);

  const { error: raceUpdateError } = await supabase.from("races").update({ lineup_id: lineupId }).eq("id", raceId);
  if (raceUpdateError) throw new Error(raceUpdateError.message);

  await linkOrCreateLaunchRecoveryTasksForLineup(supabase, {
    raceId,
    lineupId,
    eventId: race.event_id,
    userId,
  });
  return lineupId;
}
