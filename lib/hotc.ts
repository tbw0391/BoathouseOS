import "server-only";
import type { DemoClub } from "@/lib/demoClubs";
import type { LineupCategory } from "@/lib/database.types";

// The real 2026 Head of the Cuyahoga, straight from CrewTimer's public
// results feed (same feed as lib/crewtimer.ts in the club app). The race
// schedule and entries are there before race day; places and times fill in
// live as boats finish. Read per request, not stored, since each demo
// visitor picks a different club.
export const HOTC = {
  title: "Head of the Cuyahoga",
  crewTimerUrl: "https://www.crewtimer.com/regatta/r16268",
  feedUrl: "https://crewtimer-results.firebaseio.com/results/r16268.json",
};

// Demo clubs whose RegattaCentral name differs from their CrewTimer crew
// name. Everyone else matches on the club name itself.
const CREWTIMER_NAMES: Record<string, string[]> = {
  "central-catholic-rowing-club-central-cat": ["Central Catholic Rowing Club"],
  "chautauqua-lake-rowing-association-inc": ["Chautauqua Lake"],
  "cleveland-state-university-rowing-club-v": ["Cleveland State"],
  "detroit-boat-club-crew": ["Detroit Boat Club Crew", "Detroit Boat Club"],
  "huron-rowing-association-ann-arbor-huron": ["Ann Arbor Huron"],
  "jaguars-rowing": ["Jaguars Rowing Club"],
  "john-carroll-university-rowing": ["John Carroll University"],
  "louisville-rowing-club-inc": ["Louisville Rowing"],
  "portage-lakes-rowing-association": ["Portage Lakes"],
  "shaker-heights-high-school-crew": ["Shaker Heights"],
  "st-edward-high-school": ["St. Edward"],
  "st-ignatius-wildcat-rowing": ["St. Ignatius"],
  "western-reserve-rowing-association": [
    "Western Reserve Rowing Association",
    "Western Reserve",
    "Western Reserve Rowing Association Vets",
    "Western Reserve Masters Men",
    "Western Reserve Masters Women",
    "Western Reserve Rowing Reserve Masters",
  ],
};

interface FeedEntry {
  Bow?: string;
  Crew?: string;
  Stroke?: string;
  Place?: number | "";
  AdjTime?: string;
  RawTime?: string;
  PenaltyCode?: string;
}

interface FeedEvent {
  EventNum?: string;
  Event?: string;
  Start?: string;
  entries?: FeedEntry[];
}

interface Feed {
  regattaInfo?: { Date?: string };
  results?: FeedEvent[];
}

export interface HotcRace {
  eventNum: string;
  eventName: string;
  start: string | null;
  bow: string | null;
  crew: string;
  stroke: string | null;
  place: number | null;
  time: string | null;
  penalty: string | null;
  entryCount: number;
}

export interface HotcSchedule {
  date: string | null;
  races: HotcRace[];
}

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Clubs with several boats in one event enter them as "Dayton Boat Club A",
// "... B", and so on.
function withoutBoatLetter(crew: string): string {
  return crew.replace(/\s+[A-Z]$/, "");
}

export async function getHotcSchedule(club: DemoClub): Promise<HotcSchedule | null> {
  let feed: Feed;
  try {
    // A minute is fresh enough to see a result shortly after a boat finishes.
    const res = await fetch(HOTC.feedUrl, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    feed = (await res.json()) as Feed;
  } catch {
    return null;
  }

  const names = new Set((CREWTIMER_NAMES[club.slug] ?? [club.name]).map(normalize));
  const races: HotcRace[] = [];
  for (const event of feed.results ?? []) {
    const entries = event.entries ?? [];
    for (const entry of entries) {
      if (!entry.Crew || !names.has(normalize(withoutBoatLetter(entry.Crew)))) continue;
      races.push({
        eventNum: event.EventNum ?? "",
        // CrewTimer prefixes the name with its event number ("1 Mens Open 1x").
        eventName: (event.Event ?? "Race").replace(/^\d+\s+/, ""),
        start: event.Start || null,
        bow: entry.Bow || null,
        crew: entry.Crew,
        stroke: entry.Stroke || null,
        place: typeof entry.Place === "number" ? entry.Place : null,
        time: entry.AdjTime || entry.RawTime || null,
        penalty: entry.PenaltyCode || null,
        entryCount: entries.length,
      });
    }
  }

  return { date: feed.regattaInfo?.Date ?? null, races };
}

// What a demo race becomes on the Lineups page. Clubs racing more than one
// boat in an event get a letter ("Dayton Boat Club B"), which is kept so
// each boat is its own race there.
export function hotcRaceName(race: Pick<HotcRace, "eventNum" | "eventName" | "crew">): string {
  const letter = race.crew.match(/\s([A-Z])$/)?.[1];
  return `Race ${race.eventNum}: ${race.eventName}${letter ? ` (${letter} boat)` : ""}`;
}

// CrewTimer start times ("7:45 AM") are local to Cleveland, which is on
// Eastern Daylight Time for a late-September regatta.
export function hotcRaceTime(date: string | null, start: string | null): string | null {
  const match = start?.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!date || !match) return null;
  let hour = Number(match[1]) % 12;
  if (match[3].toUpperCase() === "PM") hour += 12;
  return new Date(`${date}T${String(hour).padStart(2, "0")}:${match[2]}:00-04:00`).toISOString();
}

// Best-guess lineup category from the event name ("Womens Youth 8+"), so the
// boat picker offers that team's boats and the seat picker its rowers. The
// A/B/C/D boat letter stands in for depth. Singles, doubles, pairs, and
// mixed events stay uncategorized, same as on the Lineups page.
export function hotcRaceCategory(race: Pick<HotcRace, "eventName" | "crew">): LineupCategory | null {
  const boatSlug = { "8+": "8plus", "4+": "4plus", "4x": "4x", "4-": "4minus" }[
    race.eventName.match(/(8\+|4\+|4x|4-)/)?.[1] ?? ""
  ];
  if (!boatSlug) return null;
  const letter = race.crew.match(/\s([A-D])$/)?.[1];
  const depth = letter ? letter.charCodeAt(0) - 64 : 1;
  const team = /^womens/i.test(race.eventName) ? "womens" : /^mens/i.test(race.eventName) ? "mens" : null;
  if (!team) return null;
  if (/masters/i.test(race.eventName)) {
    return boatSlug === "8plus" || boatSlug === "4plus"
      ? `masters_${Math.min(depth, 3)}_${boatSlug}`
      : null;
  }
  return `${team}_${depth}_${boatSlug}`;
}
