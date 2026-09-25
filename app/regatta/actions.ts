"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEMO_CLUB_COOKIE, findDemoClub } from "@/lib/demoClubs";
import { HOTC, getHotcSchedule, hotcRaceCategory, hotcRaceName, hotcRaceTime } from "@/lib/hotc";

// Turns one of the picked club's Head of the Cuyahoga races into a race on
// the Lineups page (creating the regatta on the schedule the first time), then
// opens it there so the coach can pick a boat. The race is looked up again in
// the live feed rather than trusting the form, and clicking twice reuses it.
export async function addRegattaRaceToLineups(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: callerProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const callerRole = (callerProfile as { role: string } | null)?.role;
  if (callerRole !== "admin" && callerRole !== "coach") {
    throw new Error("Only coaches and admins can manage lineups.");
  }

  const club = findDemoClub((await cookies()).get(DEMO_CLUB_COOKIE)?.value);
  if (!club) throw new Error("Pick your club first.");
  const schedule = await getHotcSchedule(club);
  if (!schedule?.date) throw new Error("Couldn't reach CrewTimer right now. Try again.");

  const eventNum = String(formData.get("event_num") ?? "");
  const crew = String(formData.get("crew") ?? "");
  const race = schedule.races.find((r) => r.eventNum === eventNum && r.crew === crew);
  if (!race) throw new Error("That race isn't in the schedule anymore.");

  const dayStart = new Date(`${schedule.date}T00:00:00-04:00`).toISOString();
  const dayEnd = new Date(`${schedule.date}T23:59:59-04:00`).toISOString();
  const { data: existingEvent } = await supabase
    .from("schedule_events")
    .select("id")
    .eq("title", HOTC.title)
    .gte("starts_at", dayStart)
    .lte("starts_at", dayEnd)
    .maybeSingle();

  let eventId = (existingEvent as { id: string } | null)?.id;
  if (!eventId) {
    const { data: newEvent, error } = await supabase
      .from("schedule_events")
      .insert({
        title: HOTC.title,
        event_type: "regatta",
        location: "Cuyahoga River, Cleveland, OH",
        starts_at: hotcRaceTime(schedule.date, schedule.races[0]?.start ?? "7:00 AM") ?? dayStart,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error || !newEvent) throw new Error(error?.message ?? "Couldn't add the regatta to the schedule.");
    eventId = newEvent.id as string;
  }

  const raceName = hotcRaceName(race);
  const { data: existingRace } = await supabase
    .from("races")
    .select("id")
    .eq("event_id", eventId)
    .eq("race_name", raceName)
    .maybeSingle();

  let raceId = (existingRace as { id: string } | null)?.id;
  if (!raceId) {
    const { data: newRace, error } = await supabase
      .from("races")
      .insert({
        event_id: eventId,
        race_name: raceName,
        race_time: hotcRaceTime(schedule.date, race.start),
        category: hotcRaceCategory(race),
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error || !newRace) throw new Error(error?.message ?? "Couldn't add the race.");
    raceId = newRace.id as string;
  }

  revalidatePath("/lineups");
  revalidatePath("/regatta");
  redirect(`/lineups/${eventId}?race=${raceId}`);
}
