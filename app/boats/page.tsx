import { createClient } from "@/lib/supabase/server";
import type { Boat, LineupTemplate, LineupTemplateSeat, Profile } from "@/lib/database.types";
import { AddBoatForm } from "./AddBoatForm";
import { BoatsGrid } from "./BoatsGrid";
import { LineupTemplatesSection } from "@/app/lineups/LineupTemplatesSection";

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
      .select("id, name, boat_class, category, notes, hull_color, rig, created_by, created_at")
      .order("name", { ascending: true }),
  ]);

  const boats = (data as Boat[] | null) ?? [];

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
  if (canManage) {
    const [templatesResult, seatsResult, rosterResult] = await Promise.all([
      supabase.from("lineup_templates").select("*").order("name", { ascending: true }),
      supabase.from("lineup_template_seats").select("*"),
      supabase
        .from("profiles")
        .select("id, display_name")
        .is("disabled_at", null)
        .order("display_name", { ascending: true }),
    ]);
    templates = (templatesResult.data as LineupTemplate[] | null) ?? [];
    templateSeats = ((seatsResult.data as LineupTemplateSeat[] | null) ?? []).sort(seatOrder);
    roster = (rosterResult.data as Pick<Profile, "id" | "display_name">[] | null) ?? [];
  }
  const crewSeatsByBoatId: Record<string, LineupTemplateSeat[]> = {};
  for (const t of templates) {
    if (t.boat_id) crewSeatsByBoatId[t.boat_id] = templateSeats.filter((s) => s.template_id === t.id);
  }

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
        <BoatsGrid boats={boats} canManage={canManage} crewSeatsByBoatId={crewSeatsByBoatId} roster={roster} />
      )}

      {canManage && (
        <div className="mt-8">
          <LineupTemplatesSection templates={templates} templateSeats={templateSeats} roster={roster} boats={boats} />
        </div>
      )}
    </div>
  );
}
