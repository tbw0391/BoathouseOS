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
