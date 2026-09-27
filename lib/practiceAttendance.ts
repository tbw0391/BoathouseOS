import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PracticeAttendance } from "@/lib/database.types";

// Tap choices on the "I won't be at practice" button.
export const ABSENCE_REASONS = [
  "Sick",
  "Doctor",
  "Work",
  "My big toe hurts",
  "A hotdog is a sandwich",
] as const;

// Today's Eastern calendar date as YYYY-MM-DD, the key attendance is stored under.
export const todaysPracticeDate = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

// Check-in is open Monday through Saturday, except on a day with a regatta
// (a regatta counts for every Eastern day from its start through its end).
export async function isPracticeDay(): Promise<boolean> {
  const today = todaysPracticeDate();
  const weekday = new Date().toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
  });
  if (weekday === "Sun") return false;

  const supabase = await createClient();
  const dayMs = 24 * 60 * 60 * 1000;
  const { data } = await supabase
    .from("schedule_events")
    .select("starts_at, ends_at")
    .eq("event_type", "regatta")
    .lte("starts_at", new Date(Date.now() + 2 * dayMs).toISOString())
    .gte("starts_at", new Date(Date.now() - 7 * dayMs).toISOString());
  const easternDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  return !((data as { starts_at: string; ends_at: string | null }[] | null) ?? []).some((r) => {
    const start = easternDate(r.starts_at);
    const end = r.ends_at ? easternDate(r.ends_at) : start;
    return start <= today && today <= end;
  });
}

export const formatAttendanceTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  });

// This rower's check-in or absence for today, or null if they haven't said.
export async function getMyAttendanceToday(profileId: string): Promise<PracticeAttendance | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("practice_attendance")
    .select("*")
    .eq("profile_id", profileId)
    .eq("practice_date", todaysPracticeDate())
    .maybeSingle();
  return (data as PracticeAttendance | null) ?? null;
}
