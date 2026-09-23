import { createClient } from "@/lib/supabase/server";
import type { Boat } from "@/lib/database.types";
import { BOAT_CLASSES } from "@/lib/boatClasses";
import { LINEUP_CATEGORIES } from "@/lib/lineupCategories";
import { HULL_COLORS, RIGS } from "@/lib/boatOptions";
import { AddBoatForm } from "./AddBoatForm";

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
        <div className="mt-4 grid grid-cols-3 gap-2">
          {boats.map((boat) => {
            const typeLabel = boat.category
              ? LINEUP_CATEGORIES[boat.category]
              : BOAT_CLASSES[boat.boat_class]?.label ?? boat.boat_class;
            return (
              <div
                key={boat.id}
                className="flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-[var(--color-primary)] px-3 py-3 text-sm text-center min-w-0"
              >
                <span className="truncate w-full font-medium">{boat.name}</span>
                <span className="text-xs text-gray-500 truncate w-full">{typeLabel}</span>
                <span className="flex items-center justify-center gap-1 text-[11px] text-gray-500">
                  {boat.hull_color && (
                    <>
                      <span
                        className="w-2.5 h-2.5 rounded-full border shrink-0"
                        style={{ backgroundColor: HULL_COLORS[boat.hull_color]?.swatch }}
                      />
                      {HULL_COLORS[boat.hull_color]?.label}
                    </>
                  )}
                  {boat.hull_color && boat.rig && <span>·</span>}
                  {boat.rig && RIGS[boat.rig]}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
