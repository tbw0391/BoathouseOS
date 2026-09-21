import { createClient } from "@/lib/supabase/server";
import type { Lineup, LocationPing, OnWaterSession, Profile } from "@/lib/database.types";
import { TrackingMap } from "./TrackingMap";

export interface ActiveSessionView {
  session: OnWaterSession;
  coxswainName: string;
  boatName: string | null;
  lastPing: LocationPing | null;
}

export default async function CoachTrackingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id ?? "")
    .single();
  const callerRole = (callerProfile as Pick<Profile, "role"> | null)?.role;
  const canView = callerRole === "coach" || callerRole === "admin";

  if (!canView) {
    return (
      <div className="min-h-screen p-8">
        <h1 className="text-2xl font-bold mb-6">Live Tracking</h1>
        <p className="text-sm text-gray-500">Only coaches and admins can view live tracking.</p>
      </div>
    );
  }

  const { data: sessionsData } = await supabase
    .from("on_water_sessions")
    .select("*")
    .is("ended_at", null);
  const sessions = (sessionsData as OnWaterSession[] | null) ?? [];

  const coxswainIds = [...new Set(sessions.map((s) => s.coxswain_id))];
  const { data: coxswainsData } = coxswainIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", coxswainIds)
    : { data: [] as Pick<Profile, "id" | "display_name">[] };
  const nameById = new Map(
    ((coxswainsData as Pick<Profile, "id" | "display_name">[] | null) ?? []).map((p) => [
      p.id,
      p.display_name,
    ])
  );

  const lineupIds = sessions.map((s) => s.lineup_id).filter((id): id is string => Boolean(id));
  const { data: lineupsData } = lineupIds.length
    ? await supabase.from("lineups").select("id, boat_name").in("id", lineupIds)
    : { data: [] as Pick<Lineup, "id" | "boat_name">[] };
  const boatNameById = new Map(
    ((lineupsData as Pick<Lineup, "id" | "boat_name">[] | null) ?? []).map((l) => [l.id, l.boat_name])
  );

  const sessionViews: ActiveSessionView[] = [];
  for (const session of sessions) {
    const { data: pingData } = await supabase
      .from("location_pings")
      .select("*")
      .eq("session_id", session.id)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    sessionViews.push({
      session,
      coxswainName: nameById.get(session.coxswain_id) ?? "Unknown",
      boatName: session.lineup_id ? boatNameById.get(session.lineup_id) ?? null : null,
      lastPing: pingData as LocationPing | null,
    });
  }

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-6">Live Tracking</h1>
      {sessionViews.length === 0 ? (
        <p className="text-sm text-gray-500">No one is currently on the water.</p>
      ) : (
        <TrackingMap initialSessions={sessionViews} />
      )}
    </div>
  );
}
