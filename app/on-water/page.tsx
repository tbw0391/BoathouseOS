import { createClient } from "@/lib/supabase/server";
import type { Lineup, LineupSeat, OnWaterSession, Profile } from "@/lib/database.types";
import { OnWaterTracker } from "./OnWaterTracker";

export default async function OnWaterPage() {
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

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  const { data: mySeatsData } = await supabase
    .from("lineup_seats")
    .select("*")
    .eq("seat_role", "coxswain")
    .eq("rower_id", user?.id ?? "");
  const mySeats = (mySeatsData as LineupSeat[] | null) ?? [];

  let todaysLineups: Lineup[] = [];
  if (mySeats.length > 0) {
    const { data: lineupsData } = await supabase
      .from("lineups")
      .select("*")
      .in("id", mySeats.map((s) => s.lineup_id));
    const lineups = (lineupsData as Lineup[] | null) ?? [];

    const eventIds = lineups.map((l) => l.event_id).filter((id): id is string => Boolean(id));
    if (eventIds.length > 0) {
      const { data: eventsData } = await supabase
        .from("schedule_events")
        .select("id, starts_at")
        .in("id", eventIds)
        .gte("starts_at", startOfToday.toISOString())
        .lt("starts_at", startOfTomorrow.toISOString());
      const todaysEventIds = new Set(
        ((eventsData as { id: string; starts_at: string }[] | null) ?? []).map((e) => e.id)
      );
      todaysLineups = lineups.filter((l) => l.event_id && todaysEventIds.has(l.event_id));
    }
  }

  const { data: activeSessionData } = await supabase
    .from("on_water_sessions")
    .select("*")
    .eq("coxswain_id", user?.id ?? "")
    .is("ended_at", null)
    .maybeSingle();
  const activeSession = activeSessionData as OnWaterSession | null;

  const isEligible = callerRole === "coxswain" || mySeats.length > 0;

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-6">On the Water</h1>

      {!isEligible ? (
        <p className="text-sm text-gray-500">
          You don&apos;t have a coxswain assignment today, so there&apos;s nothing to track.
        </p>
      ) : (
        <OnWaterTracker lineups={todaysLineups} activeSession={activeSession} />
      )}
    </div>
  );
}
