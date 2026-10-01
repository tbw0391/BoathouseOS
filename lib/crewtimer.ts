import "server-only";

// CrewTimer's public results feed: the race schedule and entries are there
// before race day, and places/times fill in as boats finish. Used for the
// Head of the Cuyahoga demo (lib/hotc.ts) and for importing any regatta's
// races from its CrewTimer link.

export interface FeedEntry {
  Bow?: string;
  Crew?: string;
  Stroke?: string;
  Place?: number | "";
  AdjTime?: string;
  RawTime?: string;
  PenaltyCode?: string;
}

export interface FeedEvent {
  EventNum?: string;
  Event?: string;
  Start?: string;
  entries?: FeedEntry[];
}

export interface Feed {
  regattaInfo?: { Date?: string; Title?: string };
  results?: FeedEvent[];
}

export interface CrewTimerRace {
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

// "https://www.crewtimer.com/regatta/r16268" or just "r16268" -> the feed
// URL. Only ever CrewTimer's own feed host, whatever was pasted.
export function crewTimerFeedUrl(linkOrId: string): string | null {
  const id = linkOrId.trim().match(/(?:^|\/)(r\d{3,8})(?:[/?#]|$)/i)?.[1];
  return id ? `https://crewtimer-results.firebaseio.com/results/${id.toLowerCase()}.json` : null;
}

export async function fetchCrewTimerFeed(feedUrl: string, revalidateSeconds = 60): Promise<Feed | null> {
  try {
    const res = await fetch(feedUrl, { next: { revalidate: revalidateSeconds } });
    if (!res.ok) return null;
    return ((await res.json()) as Feed | null) ?? null;
  } catch {
    return null;
  }
}

// A race's local start from CrewTimer's "Start": "7:45 AM" on the regatta's
// date, or, at multi-day regattas, "10/4 13:05" (month/day, 24-hour, AM/PM
// optional) in the regatta's year.
export function crewTimerStartLocal(
  regattaDate: string,
  start: string | null
): { date: string; hour: number; minute: number } | null {
  const m = start?.trim().match(/^(?:(\d{1,2})\/(\d{1,2})\s+)?(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!m) return null;
  let hour = Number(m[3]);
  if (m[5]) hour = (hour % 12) + (m[5].toUpperCase() === "PM" ? 12 : 0);
  else if (!m[1]) return null; // a bare "8:45" could be AM or PM
  const minute = Number(m[4]);
  if (hour > 23 || minute > 59) return null;
  const date = m[1]
    ? `${regattaDate.slice(0, 4)}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`
    : regattaDate;
  return { date, hour, minute };
}

export function normalizeCrewName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Clubs with several boats in one event enter them as "Dayton Boat Club A",
// "... B", and so on.
export function withoutBoatLetter(crew: string): string {
  return crew.replace(/\s+[A-Z]$/, "");
}

// Every entry for a club, matched on any of its names (ignoring case,
// punctuation, and the A/B/C boat letter).
export function clubRaces(feed: Feed, clubNames: string[]): CrewTimerRace[] {
  const names = new Set(clubNames.map(normalizeCrewName));
  const races: CrewTimerRace[] = [];
  for (const event of feed.results ?? []) {
    const entries = event.entries ?? [];
    for (const entry of entries) {
      if (!entry.Crew || !names.has(normalizeCrewName(withoutBoatLetter(entry.Crew)))) continue;
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
  return races;
}

// Every club entered, without boat letters, for picking your own. Spellings
// that only differ in case or punctuation count as one club (first seen wins).
export function crewNamesIn(feed: Feed): string[] {
  const byKey = new Map<string, string>();
  for (const event of feed.results ?? []) {
    for (const entry of event.entries ?? []) {
      if (!entry.Crew) continue;
      const name = withoutBoatLetter(entry.Crew.trim());
      const key = normalizeCrewName(name);
      if (!byKey.has(key)) byKey.set(key, name);
    }
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b));
}
