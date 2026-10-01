import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CoachCheckIn } from "@/lib/database.types";

// Who gets the coach check-in button, picked in Admin Settings (club_settings
// "check_in_settings"). The database lets exactly these groups check in
// (0063, 0108), so parents who aren't board members never can.
export const CHECK_IN_SETTINGS_KEY = "check_in_settings";
export const CHECK_IN_GROUPS = [
  { group: "coach", label: "Coaches" },
  { group: "board", label: "Board members (the \"Board member\" box on a profile)" },
  { group: "admin", label: "All admins" },
] as const;
export type CheckInGroup = (typeof CHECK_IN_GROUPS)[number]["group"];
const DEFAULT_CHECK_IN_GROUPS: CheckInGroup[] = ["coach", "board"];

export function parseCheckInGroups(raw: string | null | undefined): CheckInGroup[] {
  if (!raw) return [...DEFAULT_CHECK_IN_GROUPS];
  try {
    const saved = JSON.parse(raw) as { groups?: unknown };
    if (Array.isArray(saved.groups)) {
      const known: readonly string[] = CHECK_IN_GROUPS.map((g) => g.group);
      return saved.groups.filter((g): g is CheckInGroup => typeof g === "string" && known.includes(g));
    }
  } catch {
    // Unreadable: the defaults.
  }
  return [...DEFAULT_CHECK_IN_GROUPS];
}

export async function canCoachCheckIn(profileId: string, role: string | null | undefined): Promise<boolean> {
  const supabase = await createClient();
  const [{ data: setting }, { data: person }] = await Promise.all([
    supabase.from("club_settings").select("value").eq("key", CHECK_IN_SETTINGS_KEY).maybeSingle(),
    supabase.from("profiles").select("is_board_member").eq("id", profileId).maybeSingle(),
  ]);
  const groups = parseCheckInGroups((setting as { value: string | null } | null)?.value);
  if (groups.includes("coach") && role === "coach") return true;
  if (groups.includes("admin") && role === "admin") return true;
  return groups.includes("board") && Boolean((person as { is_board_member: boolean | null } | null)?.is_board_member);
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
