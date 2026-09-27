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

// Every club entered, without boat letters, for picking your own.
export function crewNamesIn(feed: Feed): string[] {
  const names = new Set<string>();
  for (const event of feed.results ?? []) {
    for (const entry of event.entries ?? []) {
      if (entry.Crew) names.add(withoutBoatLetter(entry.Crew.trim()));
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}
