import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ScheduleView } from "@/lib/database.types";

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
