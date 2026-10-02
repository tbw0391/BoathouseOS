import { createClient } from "@/lib/supabase/server";
import type { Boat, LineupCategory, LineupTemplate, LineupTemplateSeat, Profile, ProfileTeam } from "@/lib/database.types";
import { LINEUP_CATEGORY_TEAM } from "@/lib/lineupCategories";
import { AddBoatForm } from "./AddBoatForm";
import { BoatsGrid } from "./BoatsGrid";
import { LineupTemplatesSection } from "@/app/lineups/LineupTemplatesSection";
import { BoatUsageTable } from "./BoatUsageTable";
import { boatUsage, type Outing } from "@/lib/boatUsage";

// Cox first, then seats in order — same as a race lineup.
function seatOrder(a: LineupTemplateSeat, b: LineupTemplateSeat) {
  if (a.seat_role === b.seat_role) return a.seat_number - b.seat_number;
  if (a.seat_role === "coxswain") return -1;
  if (b.seat_role === "coxswain") return 1;
  return 0;
}

export default async function BoatsPage() {
  const supabase = await createClient();

  const [
    {
      data: { user },
    },
    { data, error },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("boats")
      .select("id, name, boat_class, category, notes, hull_color, rig, created_by, created_at, service_every_km, last_service_at")
      .order("name", { ascending: true }),
  ]);
  const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const { data: outingRows } = await supabase
    .from("on_water_sessions")
    .select("boat_id, started_at, ended_at, meters")
    .not("boat_id", "is", null)
    .not("ended_at", "is", null);

  const boats = (data as Boat[] | null) ?? [];

  // Boathouse logbook trips (0128) count too, unless the same trip was also
  // tracked On the Water (overlapping times on the same boat).
  const { data: signoutRows } = await supabase
    .from("boat_signouts")
    .select("boat_id, out_at, back_at, meters")
    .not("back_at", "is", null);
  const tracked = (outingRows as Outing[] | null) ?? [];
  const overlapsTracked = (o: Outing) =>
    tracked.some(
      (t) =>
        t.boat_id === o.boat_id &&
        t.ended_at &&
        o.ended_at &&
        new Date(t.started_at) < new Date(o.ended_at) &&
        new Date(o.started_at) < new Date(t.ended_at)
    );
  const logged: Outing[] = (
    (signoutRows as { boat_id: string; out_at: string; back_at: string; meters: number | null }[] | null) ?? []
  ).map((s) => ({ boat_id: s.boat_id, started_at: s.out_at, ended_at: s.back_at, meters: s.meters }));
  const outings = [...tracked, ...logged.filter((o) => !overlapsTracked(o))];

  let canManage = false;
  if (user) {
    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const role = (callerProfile as { role: string } | null)?.role;
    canManage = role === "admin" || role === "coach";
  }

  // Saved crews: each fleet boat's own (edited from its card) plus any not
  // tied to a fleet boat. Only coaches/admins edit crews.
  let templates: LineupTemplate[] = [];
  let templateSeats: LineupTemplateSeat[] = [];
  let roster: Pick<Profile, "id" | "display_name">[] = [];
  let profileTeams: ProfileTeam[] = [];
  if (canManage) {
    const [templatesResult, seatsResult, rosterResult, teamsResult] = await Promise.all([
      supabase.from("lineup_templates").select("*").order("name", { ascending: true }),
      supabase.from("lineup_template_seats").select("*"),
      supabase
        .from("profiles")
        .select("id, display_name")
        .is("disabled_at", null)
        .order("display_name", { ascending: true }),
      supabase.from("profile_teams").select("*"),
    ]);
    profileTeams = (teamsResult.data as ProfileTeam[] | null) ?? [];
    templates = (templatesResult.data as LineupTemplate[] | null) ?? [];
    templateSeats = ((seatsResult.data as LineupTemplateSeat[] | null) ?? []).sort(seatOrder);
    roster = (rosterResult.data as Pick<Profile, "id" | "display_name">[] | null) ?? [];
  }
  const crewSeatsByBoatId: Record<string, LineupTemplateSeat[]> = {};
  for (const t of templates) {
    if (t.boat_id) crewSeatsByBoatId[t.boat_id] = templateSeats.filter((s) => s.template_id === t.id);
  }

  // Like a race lineup's seat picker: a crew only offers its category's squad
  // (e.g. Women's boats offer the Women's team). Anyone already seated stays
  // listed so their name still shows.
  const profileIdsByTeam = new Map<string, Set<string>>();
  for (const row of profileTeams) {
    profileIdsByTeam.set(row.team, (profileIdsByTeam.get(row.team) ?? new Set()).add(row.profile_id));
  }
  function crewRoster(category: LineupCategory | null, seats: LineupTemplateSeat[]) {
    const team = category ? LINEUP_CATEGORY_TEAM[category] : null;
    if (!team) return roster;
    const members = profileIdsByTeam.get(team) ?? new Set<string>();
    const seated = new Set(seats.map((s) => s.rower_id));
    return roster.filter((p) => members.has(p.id) || seated.has(p.id));
  }
  const rosterByTemplateId: Record<string, Pick<Profile, "id" | "display_name">[]> = {};
  for (const t of templates) {
    const boatCategory = t.boat_id ? boats.find((b) => b.id === t.boat_id)?.category ?? null : null;
    rosterByTemplateId[t.id] = crewRoster(
      t.category ?? boatCategory,
      templateSeats.filter((s) => s.template_id === t.id)
    );
  }
  const crewRosterByBoatId: Record<string, Pick<Profile, "id" | "display_name">[]> = {};
  for (const b of boats) crewRosterByBoatId[b.id] = crewRoster(b.category, crewSeatsByBoatId[b.id] ?? []);

  return (
    <div className="min-h-screen p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Boats</h1>
        <span className="text-sm text-gray-500">
          {boats.length} boat{boats.length === 1 ? "" : "s"}
        </span>
      </div>

      {canManage && (
        <div className="flex justify-center mt-4">
          <AddBoatForm />
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 mt-4">Couldn&apos;t load boats: {error.message}</p>
      )}

      {!error && boats.length === 0 && (
        <p className="text-sm text-gray-500 mt-4">No boats yet.</p>
      )}

      {boats.length > 0 && (
        <BoatsGrid
          boats={boats}
          canManage={canManage}
          crewSeatsByBoatId={crewSeatsByBoatId}
          crewRosterByBoatId={crewRosterByBoatId}
        />
      )}

      {canManage && boats.length > 0 && (
        <BoatUsageTable
          canManage={canManage}
          rows={boats.map((b) => ({
            id: b.id,
            name: b.name,
            serviceEveryKm: b.service_every_km,
            lastServiceAt: b.last_service_at,
            usage: boatUsage(b, outings, yearAgo),
          }))}
        />
      )}

      {canManage && (
        <div className="mt-8">
          <LineupTemplatesSection
            templates={templates}
            templateSeats={templateSeats}
            rosterByTemplateId={rosterByTemplateId}
            boats={boats}
          />
        </div>
      )}
    </div>
  );
}
