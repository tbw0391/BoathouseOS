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

// For now regattas never move to Past: they stay under Upcoming until we
// decide how long to keep them (it used to be two days after race day, see
// git history). Everything else is past once its start time has gone by.
export function isPastEvent(event: Pick<ScheduleEvent, "event_type" | "starts_at">, now = new Date()): boolean {
  if (event.event_type === "regatta") return false;
  return new Date(event.starts_at).getTime() < now.getTime();
}
