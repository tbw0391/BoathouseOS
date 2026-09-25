import "server-only";
import type { Lineup, LineupSeat, Profile, ScheduleEvent } from "@/lib/database.types";

type SupabaseClient = Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>;

// CrewTimer (crewtimer.com) publishes every regatta's live results as a
// plain, unauthenticated Firebase Realtime Database read — no scraping or
// API key needed. See https://github.com/crewtimer/crewtimer-common
// (src/types/ResultTypes.ts: "Contents of /results/<regattaId> in database").
const OUR_CREW_NAME = "westerville";

// Races finish over the course of a whole regatta day; refresh often enough
// that someone checking the app minutes after a race sees it, without
// hitting CrewTimer on every single page view.
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CrewTimerEntry {
  Bow?: string;
  Crew?: string;
  Place?: number;
  // This club's CrewTimer lineup sheets put the coxswain's name in the
  // "Stroke" column (CrewTimer's data dictionary: Stroke's alias is "Cox").
  // CoxName is checked first in case a sheet ever uses it directly.
  Stroke?: string;
  CoxName?: string;
  AdjTime?: string;
  RawTime?: string;
  Time?: string;
}

interface CrewTimerEvent {
  EventNum?: string;
  Event?: string;
  Start?: string;
  entries?: CrewTimerEntry[];
}

interface CrewTimerRegattaInfo {
  Title?: string;
  Date?: string; // "YYYY-MM-DD"
  LogoURL?: string;
}

interface CrewTimerResults {
  results?: CrewTimerEvent[];
  regattaInfo?: CrewTimerRegattaInfo;
}

function resultsUrl(mobileId: string): string {
  if (mobileId.startsWith("t.")) {
    return `https://crewtimer-results-dev.firebaseio.com/results/${mobileId.slice(2)}.json`;
  }
  return `https://crewtimer-results.firebaseio.com/results/${mobileId}.json`;
}

async function fetchResults(mobileId: string): Promise<CrewTimerResults | null> {
  try {
    const res = await fetch(resultsUrl(mobileId), { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as CrewTimerResults;
  } catch {
    return null;
  }
}

// A CrewTimer mobile ID looks like "r12967" (or "t.r12967" for their dev
// server) and shows up as-is somewhere in that regatta's crewtimer.com URL,
// whatever the exact path shape — so pulling it out with a regex works
// whether someone pastes the bare ID or a full link.
const MOBILE_ID_PATTERN = /\bt\.r\d+\b|\br\d{3,7}\b/i;

export function extractCrewTimerMobileId(input: string): string | null {
  const match = input.match(MOBILE_ID_PATTERN);
  return match ? match[0] : null;
}

export interface CrewTimerRaceRow {
  race_name: string;
  race_time?: string;
}

export interface CrewTimerRegattaPreview {
  title: string | null;
  date: string | null;
  iconUrl: string | null;
  raceRows: CrewTimerRaceRow[];
}

// Builds a preview of what "Add regatta from a link" would create for a
// CrewTimer regatta: the regatta's own title/date/logo, plus one race row
// per event we're entered in (Crew contains "Westerville") — the same shape
// importRaces() already accepts from a manual heat-sheet upload, just
// sourced from CrewTimer instead of an Excel file.
export async function fetchCrewTimerRegattaPreview(mobileId: string): Promise<CrewTimerRegattaPreview | null> {
  const data = await fetchResults(mobileId);
  if (!data) return null;

  const raceRows: CrewTimerRaceRow[] = [];
  for (const ctEvent of data.results ?? []) {
    const ourEntries = (ctEvent.entries ?? []).filter((e) => e.Crew?.toLowerCase().includes(OUR_CREW_NAME));
    if (ourEntries.length === 0) continue;

    const label = [ctEvent.EventNum, ctEvent.Event].filter(Boolean).join(" - ") || ctEvent.Event || "Race";
    let raceTime: string | undefined;
    if (data.regattaInfo?.Date && ctEvent.Start) {
      const parsed = new Date(`${data.regattaInfo.Date}T${ctEvent.Start}`);
      if (!isNaN(parsed.getTime())) raceTime = parsed.toISOString();
    }

    // One row per entry, not per event — covers the (rare) case of two of
    // our boats entered in the same event.
    for (let i = 0; i < ourEntries.length; i++) {
      raceRows.push({ race_name: label, race_time: raceTime });
    }
  }

  return {
    title: data.regattaInfo?.Title ?? null,
    date: data.regattaInfo?.Date ?? null,
    iconUrl: data.regattaInfo?.LogoURL ?? null,
    raceRows,
  };
}

function entryFinishTime(entry: CrewTimerEntry): string | null {
  return entry.AdjTime || entry.RawTime || entry.Time || null;
}

function lastNameMatches(lastName: string, crewTimerCoxField: string | undefined): boolean {
  if (!crewTimerCoxField) return false;
  return crewTimerCoxField.toLowerCase().includes(lastName.toLowerCase());
}

// The rower whose name we'll look for in CrewTimer's cox column for this
// boat: the coxswain if it has one, otherwise whichever rower seat is
// numbered lowest (seat 1) — CrewTimer's Stroke/Cox field is still the only
// per-entry name field available, even for uncoxed boats (1x/2x/4x/2-).
function referenceSeatRowerId(lineupId: string, seats: LineupSeat[]): string | null {
  const lineupSeats = seats.filter((s) => s.lineup_id === lineupId && s.rower_id);
  const cox = lineupSeats.find((s) => s.seat_role === "coxswain");
  if (cox) return cox.rower_id;

  const rowers = lineupSeats
    .filter((s) => s.seat_role === "rower")
    .sort((a, b) => a.seat_number - b.seat_number);
  return rowers[0]?.rower_id ?? null;
}

// Fetches this regatta's CrewTimer results (if a mobile ID is set and the
// last sync isn't fresh) and fills in place/result_time for any of our
// boats it can match by crew name + a reference rower's last name (the
// coxswain's, or seat 1's for an uncoxed boat). Mutates `lineups` in place
// so the caller's already-fetched array reflects the update immediately,
// without a second round-trip.
export async function getOrRefreshCrewTimerResults(
  supabase: SupabaseClient,
  event: ScheduleEvent,
  lineups: Lineup[],
  seats: LineupSeat[]
): Promise<void> {
  const mobileId = event.crewtimer_mobile_id?.trim();
  if (!mobileId) return;

  const lastSynced = event.crewtimer_synced_at ? new Date(event.crewtimer_synced_at).getTime() : 0;
  if (Date.now() - lastSynced < CACHE_TTL_MS) return;

  const data = await fetchResults(mobileId);

  const ourEntries = (data?.results ?? [])
    .flatMap((ctEvent) => ctEvent.entries ?? [])
    .filter((entry) => entry.Place != null && entry.Crew?.toLowerCase().includes(OUR_CREW_NAME));

  if (ourEntries.length) {
    const referenceRowerIdByLineupId = new Map<string, string>();
    for (const lineup of lineups) {
      const rowerId = referenceSeatRowerId(lineup.id, seats);
      if (rowerId) referenceRowerIdByLineupId.set(lineup.id, rowerId);
    }

    if (referenceRowerIdByLineupId.size) {
      const { data: refProfiles } = await supabase
        .from("profiles")
        .select("id, last_name")
        .in("id", Array.from(referenceRowerIdByLineupId.values()));
      const lastNameByProfileId = new Map(
        ((refProfiles as Pick<Profile, "id" | "last_name">[] | null) ?? []).map((p) => [p.id, p.last_name])
      );

      for (const lineup of lineups) {
        const refId = referenceRowerIdByLineupId.get(lineup.id);
        const refLastName = refId ? lastNameByProfileId.get(refId) : null;
        if (!refLastName) continue;

        const match = ourEntries.find((entry) =>
          lastNameMatches(refLastName, entry.CoxName || entry.Stroke)
        );
        if (!match) continue;

        const resultTime = entryFinishTime(match);
        if (lineup.place === match.Place && lineup.result_time === resultTime) continue;

        const { error } = await supabase
          .from("lineups")
          .update({ place: match.Place, result_time: resultTime })
          .eq("id", lineup.id);
        if (!error) {
          lineup.place = match.Place ?? null;
          lineup.result_time = resultTime;
        }
      }
    }
  }

  const syncedAt = new Date().toISOString();
  await supabase.from("schedule_events").update({ crewtimer_synced_at: syncedAt }).eq("id", event.id);
  event.crewtimer_synced_at = syncedAt;
}
