import type { SupabaseServerClient } from "@/lib/raceWorkflow";
import { OAR_COLORS_KEY, boatOarSet, parseOarSettings, tapeSwatch } from "@/lib/oarSheet";

export type BoatOarsShown = { tape_color: string; rings: number; swatch: string };

// Each boat's picked oar set ("1 Green") with the club's shade for its tape,
// for showing the dots on banners and lineups. Boats with no set (or seats
// that disagree) are left out.
export async function loadBoatOars(
  supabase: SupabaseServerClient,
  lineupIds: string[]
): Promise<Map<string, BoatOarsShown>> {
  const out = new Map<string, BoatOarsShown>();
  if (lineupIds.length === 0) return out;
  const [{ data: oarRows }, { data: setting }] = await Promise.all([
    supabase.from("lineup_oars").select("lineup_id, tape_color, rings").in("lineup_id", lineupIds),
    supabase.from("club_settings").select("value").eq("key", OAR_COLORS_KEY).maybeSingle(),
  ]);
  const rows = (oarRows as { lineup_id: string; tape_color: string; rings: number }[] | null) ?? [];
  const colors = parseOarSettings((setting as { value: string | null } | null)?.value).colors;
  for (const id of new Set(rows.map((r) => r.lineup_id))) {
    const set = boatOarSet(rows.filter((r) => r.lineup_id === id));
    if (set) out.set(id, { tape_color: set.tape_color, rings: set.rings, swatch: tapeSwatch(set.tape_color, colors) });
  }
  return out;
}
