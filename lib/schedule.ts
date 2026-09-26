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

// Regattas stay under Upcoming through the two days after race day (so
// results and photos are easy to find), then move to Past. Compared as
// Eastern calendar dates so it flips at midnight, not at the start time.
// Everything else is past once its start time has gone by.
export function isPastEvent(event: Pick<ScheduleEvent, "event_type" | "starts_at">, now = new Date()): boolean {
  if (event.event_type !== "regatta") return new Date(event.starts_at).getTime() < now.getTime();
  const easternDate = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const lastUpcomingDay = new Date(new Date(event.starts_at).getTime() + 2 * 24 * 60 * 60 * 1000);
  return easternDate(now) > easternDate(lastUpcomingDay);
}
