"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  DELAY_MINUTE_OPTIONS,
  LAUNCH_MINUTES_KEY,
  LAUNCH_MINUTE_OPTIONS,
  RACE_SOON_MINUTES,
  clubTimeLabel,
  delayedRaceTime,
} from "@/lib/raceDay";
import { guardianIdsFor, sendPush } from "@/lib/push";
import type { Lineup, ScheduleEvent } from "@/lib/database.types";
import { UserError, tryAction } from "@/lib/userError";

async function requireRole(roles: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UserError("Not signed in.");
  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = (data as { role: string } | null)?.role;
  if (!role || !roles.includes(role)) throw new UserError("You can't change this.");
  return supabase;
}

export async function saveBowNumber(lineupId: string, bowNumber: string) {
  const supabase = await requireRole(["coach", "admin"]);
  const value = bowNumber.trim().slice(0, 10) || null;
  const { error } = await supabase.from("lineups").update({ bow_number: value }).eq("id", lineupId);
  if (error) throw new Error(error.message);
  revalidatePath("/race-day");
}

// Club settings are admin-only (RLS).
export async function saveLaunchMinutes(minutes: number) {
  return tryAction(async () => {
    const supabase = await requireRole(["admin"]);
    if (!LAUNCH_MINUTE_OPTIONS.includes(minutes)) throw new UserError("Pick one of the listed times.");
    const { error } = await supabase
      .from("club_settings")
      .upsert({ key: LAUNCH_MINUTES_KEY, value: String(minutes) }, { onConflict: "club_id,key" });
    if (error) throw new Error(error.message);
    revalidatePath("/race-day");
  });
}

type Supabase = Awaited<ReturnType<typeof requireRole>>;

async function crewIds(supabase: Supabase, lineupIds: string[]): Promise<string[]> {
  if (lineupIds.length === 0) return [];
  const { data } = await supabase.from("lineup_seats").select("rower_id").in("lineup_id", lineupIds);
  return [
    ...new Set(
      ((data as { rower_id: string | null }[] | null) ?? []).map((s) => s.rower_id).filter((id): id is string => !!id)
    ),
  ];
}

// Race day running late: pushes back every race and launch time shown (and
// the launch reminder), and tells the crews still to race and their parents.
export async function saveRaceDelay(eventId: string, minutes: number) {
  return tryAction(async () => {
    const supabase = await requireRole(["coach", "admin"]);
    if (!DELAY_MINUTE_OPTIONS.includes(minutes)) throw new UserError("Pick one of the listed delays.");
    const { data: eventRow } = await supabase
      .from("schedule_events")
      .select("id, title, race_delay_minutes")
      .eq("id", eventId)
      .single();
    const event = eventRow as Pick<ScheduleEvent, "id" | "title" | "race_delay_minutes"> | null;
    if (!event) throw new UserError("That regatta isn't on the schedule any more.");
    if (event.race_delay_minutes === minutes) return;

    const { error } = await supabase.from("schedule_events").update({ race_delay_minutes: minutes }).eq("id", eventId);
    if (error) throw new Error(error.message);

    const { data: lineupRows } = await supabase
      .from("lineups")
      .select("id")
      .eq("event_id", eventId)
      .is("place", null);
    const crew = await crewIds(
      supabase,
      ((lineupRows as { id: string }[] | null) ?? []).map((l) => l.id)
    );
    await sendPush([...crew, ...(await guardianIdsFor(crew))], {
      kind: "running_late",
      title: minutes ? `${event.title} is running ${minutes} min late` : `${event.title} is back on schedule`,
      body: minutes
        ? `Races and launch times are ${minutes} minutes later than scheduled. Tap for the new times.`
        : "Races and launch times are back to the scheduled times.",
      url: "/race-day",
      tag: `late-${eventId}`,
    });
    revalidatePath("/race-day");
    revalidatePath("/");
  });
}

// The USGS gauge for a regatta's "Water at the course" card (0110); null lets
// the app pick.
export async function saveRegattaGauge(eventId: string, site: string | null) {
  return tryAction(async () => {
    const supabase = await requireRole(["coach", "admin"]);
    if (site !== null && !/^\d{8,15}$/.test(site)) throw new UserError("Pick a gauge from the list.");
    const { error } = await supabase.from("schedule_events").update({ water_gauge_site: site }).eq("id", eventId);
    if (error) throw new Error(error.message);
    revalidatePath("/race-day");
  });
}

// "Racing in about 20 minutes", sent by a coach when they can see it's
// close (race times slip too much to send it automatically). Once per race.
export async function sendRaceSoon(lineupId: string) {
  return tryAction(async () => {
    const supabase = await requireRole(["coach", "admin"]);
    const crew = await crewIds(supabase, [lineupId]);
    if (crew.length === 0) throw new UserError("Nobody is in this boat yet.");
    const { data: claimed, error } = await supabase
      .from("lineups")
      .update({ race_soon_sent_at: new Date().toISOString() })
      .eq("id", lineupId)
      .is("race_soon_sent_at", null)
      .select("id, boat_name, race_name, race_time, bow_number, schedule_events(race_delay_minutes)")
      .maybeSingle();
    if (error) throw new Error(error.message);
    const lineup = claimed as unknown as
      | (Pick<Lineup, "id" | "boat_name" | "race_name" | "race_time" | "bow_number"> & {
          schedule_events: Pick<ScheduleEvent, "race_delay_minutes"> | null;
        })
      | null;
    if (!lineup) throw new UserError("That alert already went out.");

    const at = lineup.race_time
      ? `: racing at ${clubTimeLabel(delayedRaceTime(lineup.race_time, lineup.schedule_events?.race_delay_minutes))}`
      : "";
    await sendPush([...crew, ...(await guardianIdsFor(crew))], {
      kind: "race_soon",
      title: `Racing in about ${RACE_SOON_MINUTES} minutes`,
      body: `${lineup.race_name ?? lineup.boat_name}${lineup.bow_number ? `, bow #${lineup.bow_number}` : ""}${at}.`,
      url: "/race-day",
      tag: `race-soon-${lineup.id}`,
    });
    revalidatePath("/race-day");
  });
}
