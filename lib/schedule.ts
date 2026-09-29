import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ScheduleEvent, ScheduleView } from "@/lib/database.types";

export async function getUnreadScheduleCount(userId: string): Promise<number> {
  const supabase = await createClient();

  const { data: viewData } = await supabase
    .from("schedule_views")
    .select("last_viewed_at")
    .eq("user_id", userId)
    .maybeSingle();
  const since = (viewData as Pick<ScheduleView, "last_viewed_at"> | null)?.last_viewed_at ?? new Date(0).toISOString();

  const { count } = await supabase
    .from("schedule_events")
    .select("id", { count: "exact", head: true })
    .gt("created_at", since);

  return count ?? 0;
}

// Regattas never move to Past: once finished they're listed under
// "Finished" instead (regattaIsFinished in lib/raceDay.ts). Everything else
// is past once its start time has gone by.
export function isPastEvent(event: Pick<ScheduleEvent, "event_type" | "starts_at">, now = new Date()): boolean {
  if (event.event_type === "regatta") return false;
  return new Date(event.starts_at).getTime() < now.getTime();
}
