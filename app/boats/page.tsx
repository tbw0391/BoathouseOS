import { createClient } from "@/lib/supabase/server";
import type { Boat } from "@/lib/database.types";
import { AddBoatForm } from "./AddBoatForm";
import { BoatsGrid } from "./BoatsGrid";

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

      {boats.length > 0 && <BoatsGrid boats={boats} canManage={canManage} />}
    </div>
  );
}
