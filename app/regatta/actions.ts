"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEMO_CLUB_COOKIE, findDemoClub } from "@/lib/demoClubs";
import {
  HOTC,
  getHotcSchedule,
  hotcRaceCategory,
  hotcRaceName,
  hotcRaceTime,
  type HotcRace,
  type HotcSchedule,
} from "@/lib/hotc";
import { insertRaces, type SupabaseServerClient } from "@/lib/raceWorkflow";

async function requireManager(supabase: SupabaseServerClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: callerProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const callerRole = (callerProfile as { role: string } | null)?.role;
  if (callerRole !== "admin" && callerRole !== "coach") {
    throw new Error("Only coaches and admins can manage lineups.");
  }
  return { user };
}

// The picked club's live Head of the Cuyahoga schedule. Races are always
// looked up again here rather than trusting the form.
async function loadSchedule(): Promise<HotcSchedule & { date: string; clubSlug: string }> {
  const club = findDemoClub((await cookies()).get(DEMO_CLUB_COOKIE)?.value);
  if (!club) throw new Error("Pick your club first.");
  const schedule = await getHotcSchedule(club);
  if (!schedule?.date) throw new Error("Couldn't reach CrewTimer right now. Try again.");
  return { ...(schedule as HotcSchedule & { date: string }), clubSlug: club.slug };
}

// The regatta on the schedule for race day, created the first time.
async function findOrCreateEvent(
  supabase: SupabaseServerClient,
  schedule: HotcSchedule & { date: string },
  userId: string
): Promise<string> {
  const dayStart = new Date(`${schedule.date}T00:00:00-04:00`).toISOString();
  const dayEnd = new Date(`${schedule.date}T23:59:59-04:00`).toISOString();
  const { data: existingEvent } = await supabase
    .from("schedule_events")
    .select("id")
    .eq("title", HOTC.title)
    .gte("starts_at", dayStart)
    .lte("starts_at", dayEnd)
    .maybeSingle();
  if (existingEvent) return (existingEvent as { id: string }).id;

  const { data: newEvent, error } = await supabase
    .from("schedule_events")
    .insert({
      title: HOTC.title,
      event_type: "regatta",
      location: "Cuyahoga River, Cleveland, OH",
      starts_at: hotcRaceTime(schedule.date, schedule.races[0]?.start ?? "7:00 AM") ?? dayStart,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error || !newEvent) throw new Error(error?.message ?? "Couldn't add the regatta to the schedule.");
  return newEvent.id as string;
}

function toNewRace(date: string, race: HotcRace) {
  return {
    race_name: hotcRaceName(race),
    race_time: hotcRaceTime(date, race.start),
    category: hotcRaceCategory(race),
  };
}

function revalidate() {
  revalidatePath("/lineups", "layout");
  revalidatePath("/regatta");
  revalidatePath("/coach/tasks");
  revalidatePath("/");
}

// One race onto the Lineups page. Stays on this page afterwards; the race's
// row then links to it.
export async function addRegattaRaceToLineups(formData: FormData) {
  const supabase = await createClient();
  const { user } = await requireManager(supabase);
  const schedule = await loadSchedule();

  const eventNum = String(formData.get("event_num") ?? "");
  const crew = String(formData.get("crew") ?? "");
  const race = schedule.races.find((r) => r.eventNum === eventNum && r.crew === crew);
  if (!race) throw new Error("That race isn't in the schedule anymore.");

  const eventId = await findOrCreateEvent(supabase, schedule, user.id);
  await insertRaces(supabase, {
    eventId,
    userId: user.id,
    races: [toNewRace(schedule.date, race)],
    clubSlug: schedule.clubSlug,
  });
  revalidate();
}

// Every one of the club's races that hasn't finished yet, in one tap, then
// on to the regatta's Lineups page to put boats in them. Races already added
// are skipped, so tapping again only picks up new entries.
export async function addAllRegattaRaces() {
  const supabase = await createClient();
  const { user } = await requireManager(supabase);
  const schedule = await loadSchedule();

  const eventId = await findOrCreateEvent(supabase, schedule, user.id);
  await insertRaces(supabase, {
    eventId,
    userId: user.id,
    races: schedule.races.filter((r) => r.place == null).map((r) => toNewRace(schedule.date, r)),
    clubSlug: schedule.clubSlug,
  });
  revalidate();
  redirect(`/lineups/${eventId}`);
}
