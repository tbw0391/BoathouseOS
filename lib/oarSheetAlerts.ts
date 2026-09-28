import "server-only";
import { sendPush } from "@/lib/push";
import { captainSeat } from "@/lib/oarSheet";
import type { SupabaseServerClient } from "@/lib/raceWorkflow";

// Tells a regatta boat's cox (or stroke, with no cox) to fill in its oar
// sheet and pick Launch/Recovery. With onlySeatId, only when that seat is
// the captain's (so moving someone into seat 3 doesn't re-alert the cox).
export async function notifyOarSheetCaptain(
  supabase: SupabaseServerClient,
  lineupId: string,
  { onlySeatId }: { onlySeatId?: string } = {}
) {
  const { data: lineup } = await supabase
    .from("lineups")
    .select("id, boat_id, boat_name, race_name, event_id")
    .eq("id", lineupId)
    .maybeSingle();
  if (!lineup?.boat_id || !lineup.event_id) return;

  const { data: event } = await supabase
    .from("schedule_events")
    .select("title, event_type, starts_at")
    .eq("id", lineup.event_id)
    .maybeSingle();
  if (!event || event.event_type !== "regatta") return;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  if (new Date(event.starts_at) < startOfToday) return;

  const { data: seatRows } = await supabase
    .from("lineup_seats")
    .select("id, seat_number, seat_role, rower_id")
    .eq("lineup_id", lineupId);
  const captain = captainSeat(
    (seatRows as { id: string; seat_number: number; seat_role: string; rower_id: string | null }[] | null) ?? []
  );
  if (!captain?.rower_id) return;
  if (onlySeatId && captain.id !== onlySeatId) return;

  await sendPush([captain.rower_id], {
    kind: "oar_sheet",
    title: `Oar sheet: ${lineup.boat_name}`,
    body: `Pick the oars and who does Launch and Recovery for ${lineup.race_name ?? lineup.boat_name} at ${event.title}.`,
    url: `/oar-sheet/${lineupId}`,
    tag: `oar-sheet-${lineupId}`,
  });
}
