import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Boat, Lineup, LineupSeat, OnWaterSession, Profile } from "@/lib/database.types";
import { getActiveBoats } from "@/lib/onWater";
import { LiveBoats } from "@/app/coach/tracking/LiveBoats";
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

  // Coaches and admins watch: which boats are out, and a map of them.
  if (callerRole === "coach" || callerRole === "admin") {
    const activeBoats = await getActiveBoats();
    return (
      <div className="min-h-screen p-8">
        <h1 className="text-2xl font-bold mb-6">On the Water</h1>
        <LiveBoats initialSessions={activeBoats} />
      </div>
    );
  }

  if (callerRole !== "coxswain") {
    return (
      <div className="min-h-screen p-8">
        <h1 className="text-2xl font-bold mb-6">On the Water</h1>
        <p className="text-sm text-gray-500">
          GPS tracking is for coxswains. Coaches can see every boat on the water from here.
        </p>
      </div>
    );
  }

  const [{ data: boatsData }, { data: activeSessionData }, { data: colorsInUseData }, { data: mySeatsData }] =
    await Promise.all([
      supabase.from("boats").select("id, name").order("name"),
      supabase
        .from("on_water_sessions")
        .select("*")
        .eq("coxswain_id", user?.id ?? "")
        .is("ended_at", null)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.rpc("on_water_colors_in_use"),
      supabase
        .from("lineup_seats")
        .select("lineup_id")
        .eq("seat_role", "coxswain")
        .eq("rower_id", user?.id ?? ""),
    ]);
  const boats = (boatsData as Pick<Boat, "id" | "name">[] | null) ?? [];
  const activeSession = activeSessionData as OnWaterSession | null;
  const colorsInUse = (colorsInUseData as string[] | null) ?? [];

  // If they cox a lineup today, start with that boat picked.
  let suggestedBoatId: string | null = null;
  const lineupIds = ((mySeatsData as Pick<LineupSeat, "lineup_id">[] | null) ?? []).map((s) => s.lineup_id);
  if (lineupIds.length > 0) {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    const { data: lineupsData } = await supabase
      .from("lineups")
      .select("boat_id, schedule_events(starts_at)")
      .in("id", lineupIds)
      .not("boat_id", "is", null);
    const todays = ((lineupsData as unknown as (Pick<Lineup, "boat_id"> & {
      schedule_events: { starts_at: string } | null;
    })[] | null) ?? []).find(
      (l) =>
        l.schedule_events &&
        new Date(l.schedule_events.starts_at).toLocaleDateString("en-CA", { timeZone: "America/New_York" }) ===
          today
    );
    suggestedBoatId = todays?.boat_id ?? null;
  }

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-6">On the Water</h1>
      {boats.length === 0 ? (
        <p className="text-sm text-gray-500">
          There are no boats set up yet. A coach can add them on the{" "}
          <Link href="/boats" className="underline">
            Boats
          </Link>{" "}
          page.
        </p>
      ) : (
        <OnWaterTracker
          boats={boats}
          suggestedBoatId={suggestedBoatId}
          colorsInUse={colorsInUse}
          activeSession={activeSession}
        />
      )}
    </div>
  );
}
