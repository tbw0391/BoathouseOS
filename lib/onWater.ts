import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Lineup, LocationPing, OnWaterSession, Profile } from "@/lib/database.types";

export interface ActiveSessionView {
  session: OnWaterSession;
  coxswainName: string;
  boatName: string | null;
  lastPing: LocationPing | null;
}

// Every outing on the water right now, with its boat, coxswain and latest
// GPS fix. Only coaches and admins can read other people's sessions.
export async function getActiveBoats(): Promise<ActiveSessionView[]> {
  const supabase = await createClient();

  const { data: sessionsData } = await supabase
    .from("on_water_sessions")
    .select("*")
    .is("ended_at", null)
    .order("started_at", { ascending: true });
  const sessions = (sessionsData as OnWaterSession[] | null) ?? [];
  if (sessions.length === 0) return [];

  const coxswainIds = [...new Set(sessions.map((s) => s.coxswain_id))];
  const boatIds = sessions.map((s) => s.boat_id).filter((id): id is string => Boolean(id));
  const lineupIds = sessions.map((s) => s.lineup_id).filter((id): id is string => Boolean(id));

  const [{ data: coxswainsData }, { data: boatsData }, { data: lineupsData }] = await Promise.all([
    supabase.from("profiles").select("id, display_name").in("id", coxswainIds),
    boatIds.length
      ? supabase.from("boats").select("id, name").in("id", boatIds)
      : Promise.resolve({ data: [] }),
    lineupIds.length
      ? supabase.from("lineups").select("id, boat_name").in("id", lineupIds)
      : Promise.resolve({ data: [] }),
  ]);
  const nameById = new Map(
    ((coxswainsData as Pick<Profile, "id" | "display_name">[] | null) ?? []).map((p) => [p.id, p.display_name])
  );
  const boatNameById = new Map(
    ((boatsData as { id: string; name: string }[] | null) ?? []).map((b) => [b.id, b.name])
  );
  const lineupBoatNameById = new Map(
    ((lineupsData as Pick<Lineup, "id" | "boat_name">[] | null) ?? []).map((l) => [l.id, l.boat_name])
  );

  const lastPings = await Promise.all(
    sessions.map(async (session) => {
      const { data } = await supabase
        .from("location_pings")
        .select("*")
        .eq("session_id", session.id)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as LocationPing | null;
    })
  );

  return sessions.map((session, i) => ({
    session,
    coxswainName: nameById.get(session.coxswain_id) ?? "Unknown",
    boatName:
      (session.boat_id && boatNameById.get(session.boat_id)) ||
      (session.lineup_id && lineupBoatNameById.get(session.lineup_id)) ||
      null,
    lastPing: lastPings[i],
  }));
}
