"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { BOAT_CLASSES, BOAT_CLASS_OPTIONS } from "@/lib/boatClasses";
import {
  LINEUP_CATEGORIES,
  LINEUP_CATEGORY_OPTIONS,
  categoryForRace,
} from "@/lib/lineupCategories";
import { HULL_COLOR_OPTIONS, RIG_OPTIONS } from "@/lib/boatOptions";
import type { LineupCategory } from "@/lib/database.types";
import { getSelectedClubSlug } from "@/lib/demoClubs";
import { clubRaces, crewNamesIn, crewTimerFeedUrl, fetchCrewTimerFeed, type Feed } from "@/lib/crewtimer";
import { hotcRaceCategory, hotcRaceName } from "@/lib/hotc";
import {
  boatLineupDefaults,
  buildLineupForRace,
  createLaunchRecoveryTasks,
  createLinkedTemplate,
  insertRaces,
  isUniqueViolation,
  resolveBoatType,
  seatsForBoatClass,
} from "@/lib/raceWorkflow";

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

  const hullColorRaw = String(formData.get("hull_color") ?? "").trim();
  const hullColor = HULL_COLOR_OPTIONS.includes(hullColorRaw) ? hullColorRaw : null;

  const rigRaw = String(formData.get("rig") ?? "").trim();
  const rig = RIG_OPTIONS.includes(rigRaw) ? rigRaw : null;

  const boatId = crypto.randomUUID();
  const { error } = await supabase.from("boats").insert({
    id: boatId,
    name,
    boat_class: boatClass,
    category,
    notes,
    hull_color: hullColor,
    rig,
    created_by: user.id,
  });

  if (error) throw new Error(error.message);

  if (category) {
    await createLinkedTemplate(supabase, { boatId, boatClass, category, userId: user.id });
  }

  revalidatePath("/lineups");
  revalidatePath("/boats");
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
  revalidatePath("/boats");
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

  const hullColorRaw = String(formData.get("hull_color") ?? "").trim();
  const hullColor = HULL_COLOR_OPTIONS.includes(hullColorRaw) ? hullColorRaw : null;

  const rigRaw = String(formData.get("rig") ?? "").trim();
  const rig = RIG_OPTIONS.includes(rigRaw) ? rigRaw : null;

  const { error } = await supabase
    .from("boats")
    .update({ name, boat_class: boatClass, category, notes, hull_color: hullColor, rig })
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
  revalidatePath("/boats");
}

export async function deleteBoat(formData: FormData) {
  const supabase = await createClient();
  await requireManager(supabase);

  const boatId = String(formData.get("boat_id") ?? "").trim();
  if (!boatId) throw new Error("Missing boat.");

  const { error } = await supabase.from("boats").delete().eq("id", boatId);
  if (error) throw new Error(error.message);

  revalidatePath("/lineups");
  revalidatePath("/boats");
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
  if (category && !LINEUP_CATEGORY_OPTIONS.includes(category)) {
    throw new Error("Please choose a valid category.");
  }

  const { data: boat, error: boatError } = await supabase
    .from("boats")
    .select("name, boat_class, category")
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
    category: categoryForRace(raceName, category || boat.category) as LineupCategory | null,
    notes,
    race_name: raceName,
    race_time: raceTime,
    club_slug: await getSelectedClubSlug(),
    created_by: user.id,
  });

  if (error) throw new Error(error.message);

  const { error: seatsError } = await supabase
    .from("lineup_seats")
    .insert(seats.map((s) => ({ ...s, lineup_id: lineupId })));
  if (seatsError) throw new Error(seatsError.message);

  await createLaunchRecoveryTasks(supabase, { lineupId, eventId, userId: user.id });

  revalidatePath("/lineups");
  revalidatePath("/");
  revalidatePath("/coach/tasks");
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

  const toInsert: { race_name: string; category: LineupCategory | null; race_time: string | null }[] = [];
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

    toInsert.push({ race_name: raceName, category, race_time: raceTime });
  });

  if (toInsert.length === 0) {
    return { imported: 0, errors: rowErrors.length ? rowErrors : ["No valid rows found."] };
  }

  const { raceIds } = await insertRaces(supabase, {
    eventId,
    userId: user.id,
    races: toInsert,
    clubSlug: await getSelectedClubSlug(),
  });

  revalidatePath("/lineups");
  revalidatePath("/");
  revalidatePath("/coach/tasks");
  return { imported: raceIds.length, errors: rowErrors };
}

// Wall-clock time on a date in Eastern time (EDT or EST, whichever applies
// that day) as an ISO timestamp.
function easternTimeOn(date: string, hour: number, minute: number): string {
  const guess = new Date(`${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-05:00`);
  const easternHour = Number(
    guess.toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23" })
  );
  return new Date(guess.getTime() - ((easternHour - hour + 24) % 24) * 60 * 60 * 1000).toISOString();
}

// "Paste a list" on a regatta: one race per line, optionally starting with
// its time ("9:15 AM Men's Masters 8+"). A trailing ★ (from a schedule
// description) is dropped. Races already on the regatta are skipped.
export async function addPastedRaces(eventId: string, text: string) {
  const supabase = await createClient();
  const { user } = await requireManager(supabase);
  if (!eventId) throw new Error("Missing event.");

  const { data: event } = await supabase.from("schedule_events").select("starts_at").eq("id", eventId).single();
  if (!event) throw new Error("That event couldn't be found.");
  const eventDate = new Date(event.starts_at).toLocaleDateString("en-CA", { timeZone: "America/New_York" });

  const races = text
    .split("\n")
    .map((line) => line.replace(/★\s*$/, "").trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?\s*[-–—:]?\s+(.+)$/i);
      if (!m) return { race_name: line };
      let hour = Number(m[1]) % 12;
      if (m[3]?.toLowerCase() === "pm" || (!m[3] && Number(m[1]) === 12)) hour += 12;
      if (!m[3] && Number(m[1]) > 12) hour = Number(m[1]);
      return { race_name: m[4].trim(), race_time: easternTimeOn(eventDate, hour, Number(m[2])) };
    });
  if (races.length === 0) throw new Error("Type or paste at least one race.");

  const { raceIds } = await insertRaces(supabase, {
    eventId,
    userId: user.id,
    races,
    clubSlug: await getSelectedClubSlug(),
  });

  revalidatePath("/lineups", "layout");
  revalidatePath("/");
  revalidatePath("/coach/tasks");
  return { imported: raceIds.length, skipped: races.length - raceIds.length };
}

export interface CrewTimerRaceOption {
  key: string;
  raceName: string;
  startLabel: string | null;
  crew: string;
  alreadyAdded: boolean;
}

async function loadCrewTimer(link: string): Promise<{ feed: Feed; date: string }> {
  const feedUrl = crewTimerFeedUrl(link);
  if (!feedUrl) throw new Error("Paste the regatta's CrewTimer link, like crewtimer.com/regatta/r16268.");
  const feed = await fetchCrewTimerFeed(feedUrl, 300);
  if (!feed?.results) throw new Error("Couldn't find that regatta on CrewTimer.");
  const date = feed.regattaInfo?.Date;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("That CrewTimer regatta has no date yet.");
  return { feed, date };
}

// "7:45 AM" on the regatta's date, Eastern.
function crewTimerStart(date: string, start: string | null): string | null {
  const m = start?.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let hour = Number(m[1]) % 12;
  if (m[3].toUpperCase() === "PM") hour += 12;
  return easternTimeOn(date, hour, Number(m[2]));
}

// Step 1 of "From CrewTimer": your club's entries in that regatta, or, if
// the name doesn't match, every club entered so the coach can pick theirs.
export async function findCrewTimerRaces(eventId: string, link: string, crewName: string) {
  const supabase = await createClient();
  await requireManager(supabase);
  if (!eventId) throw new Error("Missing event.");
  if (!crewName.trim()) throw new Error("Type your club's name as it appears on CrewTimer.");

  const { feed, date } = await loadCrewTimer(link);
  const races = clubRaces(feed, [crewName]);
  if (races.length === 0) {
    return { title: feed.regattaInfo?.Title ?? null, date, races: [], crewNames: crewNamesIn(feed) };
  }

  const { data: existing } = await supabase.from("races").select("race_name").eq("event_id", eventId);
  const existingNames = new Set(((existing as { race_name: string }[] | null) ?? []).map((r) => r.race_name));
  const options: CrewTimerRaceOption[] = races.map((r) => {
    const raceName = hotcRaceName(r);
    return { key: raceName, raceName, startLabel: r.start, crew: r.crew, alreadyAdded: existingNames.has(raceName) };
  });
  return { title: feed.regattaInfo?.Title ?? null, date, races: options, crewNames: [] as string[] };
}

// Step 2: add the picked ones. Looked up again from CrewTimer rather than
// trusting what the browser sent back.
export async function addCrewTimerRaces(eventId: string, link: string, crewName: string, keys: string[]) {
  const supabase = await createClient();
  const { user } = await requireManager(supabase);
  if (!eventId) throw new Error("Missing event.");

  const { feed, date } = await loadCrewTimer(link);
  const picked = new Set(keys);
  const races = clubRaces(feed, [crewName])
    .filter((r) => picked.has(hotcRaceName(r)))
    .map((r) => ({
      race_name: hotcRaceName(r),
      race_time: crewTimerStart(date, r.start),
      category: hotcRaceCategory(r),
    }));
  if (races.length === 0) throw new Error("Pick at least one race.");

  const { raceIds } = await insertRaces(supabase, {
    eventId,
    userId: user.id,
    races,
    clubSlug: await getSelectedClubSlug(),
  });

  revalidatePath("/lineups", "layout");
  revalidatePath("/");
  revalidatePath("/coach/tasks");
  return { imported: raceIds.length, skipped: races.length - raceIds.length };
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

// Builds a lineup for a specific pending race from a chosen fleet boat,
// pulling race_name/race_time from the race and category/notes/crew from
// the boat's linked saved template when it has one (falling back to the
// race's own category and an empty roster otherwise), and marks the race
// as no longer pending.
export async function createLineupForRace(formData: FormData) {
  const supabase = await createClient();
  const { user } = await requireManager(supabase);

  const raceId = String(formData.get("race_id") ?? "").trim();
  const boatId = String(formData.get("boat_id") ?? "").trim();
  if (!raceId || !boatId) throw new Error("Please choose a boat.");

  await buildLineupForRace(supabase, { raceId, boatId, userId: user.id });

  revalidatePath("/lineups");
  revalidatePath("/");
  revalidatePath("/coach/tasks");
}

// A template can either be based on a fleet boat — which pins its boat
// class/category and leaves just name/notes to fill in, since the boat
// already answered those questions — or, for boat-less crews (masters,
// development, or a class not yet in the fleet), built from scratch.
export async function createLineupTemplate(formData: FormData) {
  const supabase = await createClient();
  const { user } = await requireManager(supabase);

  const boatId = String(formData.get("boat_id") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  let name = String(formData.get("name") ?? "").trim();
  let boatClass: string;
  let category: LineupCategory | null;

  if (boatId) {
    const { data: boat, error: boatError } = await supabase
      .from("boats")
      .select("boat_class, category")
      .eq("id", boatId)
      .single();
    if (boatError || !boat) throw new Error("That boat couldn't be found.");
    boatClass = boat.boat_class;
    category = boat.category;
    if (!name && category) name = LINEUP_CATEGORIES[category] ?? "";
  } else {
    boatClass = String(formData.get("boat_class") ?? "").trim();
    if (!BOAT_CLASSES[boatClass]) throw new Error("A valid boat class is required.");
    const categoryRaw = String(formData.get("category") ?? "").trim();
    category = LINEUP_CATEGORY_OPTIONS.includes(categoryRaw) ? (categoryRaw as LineupCategory) : null;
  }

  if (!name) throw new Error("A template name is required.");

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
  if (error) {
    if (boatId && isUniqueViolation(error)) throw new Error("That boat already has a saved crew.");
    throw new Error(error.message);
  }

  const { error: seatsError } = await supabase
    .from("lineup_template_seats")
    .insert(seats.map((s) => ({ ...s, template_id: templateId })));
  if (seatsError) throw new Error(seatsError.message);

  revalidatePath("/lineups");
  revalidatePath("/boats");
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
  if (error) {
    if (boatId && isUniqueViolation(error)) throw new Error("That boat already has a saved crew.");
    throw new Error(error.message);
  }

  revalidatePath("/lineups");
  revalidatePath("/boats");
}

export async function deleteLineupTemplate(templateId: string) {
  const supabase = await createClient();
  await requireManager(supabase);

  const { error } = await supabase.from("lineup_templates").delete().eq("id", templateId);
  if (error) throw new Error(error.message);

  revalidatePath("/lineups");
  revalidatePath("/boats");
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
  revalidatePath("/boats");
}

export async function updateLineupRace(formData: FormData) {
  const supabase = await createClient();
  await requireManager(supabase);

  const lineupId = String(formData.get("lineup_id") ?? "").trim();
  if (!lineupId) throw new Error("Missing boat.");

  const raceName = String(formData.get("race_name") ?? "").trim() || null;
  const raceTimeRaw = String(formData.get("race_time") ?? "").trim();
  const raceTime = raceTimeRaw ? new Date(raceTimeRaw).toISOString() : null;

  const { data: lineup } = await supabase.from("lineups").select("category").eq("id", lineupId).single();
  const category = categoryForRace(raceName, (lineup as { category: string | null } | null)?.category ?? null);

  const { error } = await supabase
    .from("lineups")
    .update({ race_name: raceName, race_time: raceTime, category: category as LineupCategory | null })
    .eq("id", lineupId);

  if (error) throw new Error(error.message);

  revalidatePath("/lineups");
  revalidatePath("/");
}

export async function updateLineupDetails(formData: FormData) {
  const supabase = await createClient();
  await requireManager(supabase);

  const lineupId = String(formData.get("lineup_id") ?? "").trim();
  if (!lineupId) throw new Error("Missing boat.");
  const category = String(formData.get("category") ?? "").trim();
  if (category && !LINEUP_CATEGORY_OPTIONS.includes(category)) {
    throw new Error("Please choose a valid category.");
  }
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const { error } = await supabase
    .from("lineups")
    .update({ category: (category || null) as LineupCategory | null, notes })
    .eq("id", lineupId);
  if (error) throw new Error(error.message);

  revalidatePath("/lineups", "layout");
}

export async function updateLineupPlace(formData: FormData) {
  const supabase = await createClient();
  await requireManager(supabase);

  const lineupId = String(formData.get("lineup_id") ?? "").trim();
  if (!lineupId) throw new Error("Missing boat.");

  const placeRaw = String(formData.get("place") ?? "").trim();
  let place: number | null = null;
  if (placeRaw) {
    place = Math.trunc(Number(placeRaw));
    if (!Number.isFinite(place) || place < 1) throw new Error("Place must be a positive number.");
  }

  const { error } = await supabase.from("lineups").update({ place }).eq("id", lineupId);
  if (error) throw new Error(error.message);

  revalidatePath("/lineups");
  revalidatePath("/schedule/regatta");
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
  revalidatePath("/coach/tasks");
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
  revalidatePath("/");
}
