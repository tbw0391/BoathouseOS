import "server-only";
import type { DemoClub } from "@/lib/demoClubs";

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
