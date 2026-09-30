import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CoachCheckIn } from "@/lib/database.types";

// Who gets the coach check-in: coaches, and admins who also coach (on the
// Coach team). Admins who are board members or parents don't check in.
export async function canCoachCheckIn(profileId: string, role: string | null | undefined): Promise<boolean> {
  if (role === "coach") return true;
  if (role !== "admin") return false;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profile_teams")
    .select("team")
    .eq("profile_id", profileId)
    .eq("team", "coach")
    .maybeSingle();
  return Boolean(data);
}

const easternDate = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });

// When this coach/admin checked in today (Eastern calendar day), already
// formatted for the button ("5:42 PM"), or null if they haven't yet.
export async function getTodaysCheckInLabel(profileId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("coach_check_ins")
    .select("checked_in_at")
    .eq("profile_id", profileId)
    .order("checked_in_at", { ascending: true })
    .gte("checked_in_at", new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString());
  const today = easternDate(new Date());
  const first = ((data as Pick<CoachCheckIn, "checked_in_at">[] | null) ?? []).find(
    (c) => easternDate(new Date(c.checked_in_at)) === today
  );
  if (!first) return null;
  return new Date(first.checked_in_at).toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  });
}
