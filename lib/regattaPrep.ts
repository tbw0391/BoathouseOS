import "server-only";
import type { createClient } from "@/lib/supabase/server";

// The home page's "<regatta> is coming up — get ready" buttons (0096): each
// goes away once that person has opened its page for that regatta.
export type RegattaPrepItem = "food_tent" | "volunteer" | "lineups";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Records that this person opened a get-ready page. Without eventIds it
// covers every regatta the home page might be showing (the same window it
// looks in: two weeks back to a week out). Never throws — it's only there
// to tidy the home page.
export async function markRegattaPrepSeen(
  supabase: Supabase,
  userId: string,
  item: RegattaPrepItem,
  eventIds?: string[]
) {
  try {
    let ids = eventIds;
    if (!ids) {
      const now = Date.now();
      const { data } = await supabase
        .from("schedule_events")
        .select("id")
        .eq("event_type", "regatta")
        .gte("starts_at", new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString())
        .lte("starts_at", new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString());
      ids = ((data as { id: string }[] | null) ?? []).map((e) => e.id);
    }
    if (ids.length === 0) return;
    const { error } = await supabase
      .from("regatta_prep_seen")
      .upsert(
        ids.map((event_id) => ({ user_id: userId, event_id, item })),
        { onConflict: "user_id,event_id,item", ignoreDuplicates: true }
      );
    if (error) console.error("Couldn't record regatta prep visit:", error.message);
  } catch (e) {
    console.error("Couldn't record regatta prep visit:", e);
  }
}

// Which get-ready pages this person has already opened for a regatta.
export async function regattaPrepSeen(supabase: Supabase, userId: string, eventId: string): Promise<Set<RegattaPrepItem>> {
  const { data, error } = await supabase
    .from("regatta_prep_seen")
    .select("item")
    .eq("user_id", userId)
    .eq("event_id", eventId);
  if (error) return new Set();
  return new Set(((data as { item: RegattaPrepItem }[] | null) ?? []).map((r) => r.item));
}
