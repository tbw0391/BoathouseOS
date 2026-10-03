import "server-only";
import { clubDateKey } from "@/lib/raceDay";
import type { SupabaseServerClient } from "@/lib/raceWorkflow";

// Where the bottom bar's "Live results" button goes: the Results tab of a
// regatta running today (club time, any day of a multi-day regatta), or
// null on every other day so the button stays hidden.
export async function raceDayResultsHref(supabase: SupabaseServerClient): Promise<string | null> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("schedule_events")
    .select("id, starts_at, ends_at")
    .eq("event_type", "regatta")
    .gte("starts_at", weekAgo)
    .lte("starts_at", tomorrow)
    .order("starts_at", { ascending: true });
  const today = clubDateKey(now);
  const event = ((data as { id: string; starts_at: string; ends_at: string | null }[] | null) ?? []).find(
    (e) => clubDateKey(e.starts_at) <= today && today <= clubDateKey(e.ends_at ?? e.starts_at)
  );
  return event ? `/lineups/${event.id}?tab=results` : null;
}
