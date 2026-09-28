import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { EmergencyInfo } from "@/lib/database.types";
import { EmergencyList, type EmergencyRow } from "./EmergencyList";

export const dynamic = "force-dynamic";

// Coaches' dock list: every rower and coxswain's emergency contacts and
// medical notes, with whoever's on the water right now first.
export default async function CoachEmergencyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = (me as { role: string } | null)?.role;
  if (role !== "coach" && role !== "admin") redirect("/coach");

  const [{ data: people }, { data: infoRows }, { data: sessions }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, role, phone")
      .in("role", ["rower", "coxswain"])
      .is("disabled_at", null)
      .not("approved_at", "is", null)
      .order("display_name"),
    supabase.from("emergency_info").select("*"),
    supabase.from("on_water_sessions").select("lineup_id, coxswain_id").is("ended_at", null),
  ]);

  const openSessions = (sessions as { lineup_id: string | null; coxswain_id: string }[] | null) ?? [];
  const lineupIds = openSessions.map((s) => s.lineup_id).filter((id): id is string => !!id);
  const { data: seatRows } = lineupIds.length
    ? await supabase.from("lineup_seats").select("rower_id").in("lineup_id", lineupIds)
    : { data: [] };
  const onWater = new Set<string>([
    ...openSessions.map((s) => s.coxswain_id),
    ...((seatRows as { rower_id: string | null }[] | null) ?? []).map((s) => s.rower_id).filter((id): id is string => !!id),
  ]);

  const infoById = new Map(((infoRows as EmergencyInfo[] | null) ?? []).map((i) => [i.profile_id, i]));
  const rows: EmergencyRow[] = ((people as { id: string; display_name: string; role: string; phone: string | null }[] | null) ?? []).map(
    (p) => ({ id: p.id, name: p.display_name, role: p.role, ownPhone: p.phone, onWater: onWater.has(p.id), info: infoById.get(p.id) ?? null })
  );
  rows.sort((a, b) => Number(b.onWater) - Number(a.onWater) || a.name.localeCompare(b.name));

  return (
    <div className="min-h-screen p-8 max-w-2xl mx-auto">
      <Link href="/coach" className="text-sm text-gray-500 hover:underline">
        ← Coach
      </Link>
      <h1 className="text-2xl font-bold mt-4 mb-1">Emergency Info</h1>
      <p className="text-sm text-gray-600 mb-4">
        Tap a number to call. In an emergency, call 911 first. Keep this screen to yourself; it has medical details.
      </p>
      <EmergencyList rows={rows} />
    </div>
  );
}
