import "server-only";
import { clubRaces, crewTimerFeedUrl, fetchCrewTimerFeed, type CrewTimerRace } from "@/lib/crewtimer";
import { hotcRaceName } from "@/lib/hotc";
import type { SupabaseServerClient } from "@/lib/raceWorkflow";

// Live results for a regatta whose races came from CrewTimer (0131): every
// entry of ours in the feed, with places and times as boats finish. Null when
// the regatta isn't linked or CrewTimer can't be reached.
export async function crewTimerResultsFor(event: {
  crewtimer_url: string | null;
  crewtimer_crew: string | null;
}): Promise<CrewTimerRace[] | null> {
  if (!event.crewtimer_url || !event.crewtimer_crew) return null;
  const feedUrl = crewTimerFeedUrl(event.crewtimer_url);
  if (!feedUrl) return null;
  // A minute is fresh enough to see a result shortly after a boat finishes.
  const feed = await fetchCrewTimerFeed(feedUrl, 60);
  if (!feed) return null;
  return clubRaces(feed, [event.crewtimer_crew]);
}

// Copies finished places onto this regatta's matching lineups (same race
// name, as "From CrewTimer" names them), so medals and the home banner pick
// them up. Only fills a lineup with no place yet, so a coach's correction is
// never overwritten. Needs a coach/admin session (lineups RLS).
export async function syncCrewTimerPlaces(
  supabase: SupabaseServerClient,
  eventId: string,
  races: CrewTimerRace[]
): Promise<void> {
  const placeByName = new Map(
    races.filter((r) => r.place != null).map((r) => [hotcRaceName(r), r.place as number])
  );
  if (placeByName.size === 0) return;
  const { data } = await supabase
    .from("lineups")
    .select("id, race_name")
    .eq("event_id", eventId)
    .is("place", null)
    .in("race_name", [...placeByName.keys()]);
  const lineups = (data as { id: string; race_name: string }[] | null) ?? [];
  await Promise.all(
    lineups.map((l) =>
      supabase.from("lineups").update({ place: placeByName.get(l.race_name) }).eq("id", l.id).is("place", null)
    )
  );
}
