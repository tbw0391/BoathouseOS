import "server-only";
import { HOTC, hotcRaceName, type HotcSchedule } from "@/lib/hotc";
import type { SupabaseServerClient } from "@/lib/raceWorkflow";

// Copies finished places from the live Head of the Cuyahoga feed onto the
// matching lineups (same race name, on that day's regatta), so results and
// medals show up without anyone typing them in. Only fills a lineup that has
// no place yet, so a coach's own correction is never overwritten. Needs a
// coach/admin session to write (lineups RLS); for anyone else it's a no-op.
export async function syncHotcResults(supabase: SupabaseServerClient, schedule: HotcSchedule | null): Promise<void> {
  if (!schedule?.date) return;
  const placeByName = new Map(
    schedule.races.filter((r) => r.place != null).map((r) => [hotcRaceName(r), r.place as number])
  );
  if (placeByName.size === 0) return;

  const { data: eventRows } = await supabase
    .from("schedule_events")
    .select("id")
    .eq("title", HOTC.title)
    .gte("starts_at", new Date(`${schedule.date}T00:00:00-04:00`).toISOString())
    .lte("starts_at", new Date(`${schedule.date}T23:59:59-04:00`).toISOString());
  const eventIds = ((eventRows as { id: string }[] | null) ?? []).map((e) => e.id);
  if (eventIds.length === 0) return;

  const { data: lineupRows } = await supabase
    .from("lineups")
    .select("id, race_name")
    .in("event_id", eventIds)
    .is("place", null)
    .in("race_name", [...placeByName.keys()]);
  const lineups = (lineupRows as { id: string; race_name: string }[] | null) ?? [];

  await Promise.all(
    lineups.map((l) =>
      supabase.from("lineups").update({ place: placeByName.get(l.race_name) }).eq("id", l.id).is("place", null)
    )
  );
}
