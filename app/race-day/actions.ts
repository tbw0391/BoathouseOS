"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { LAUNCH_MINUTES_KEY, LAUNCH_MINUTE_OPTIONS } from "@/lib/raceDay";

async function requireRole(roles: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = (data as { role: string } | null)?.role;
  if (!role || !roles.includes(role)) throw new Error("You can't change this.");
  return supabase;
}

export async function saveBowNumber(lineupId: string, bowNumber: string) {
  const supabase = await requireRole(["coach", "admin"]);
  const value = bowNumber.trim().slice(0, 10) || null;
  const { error } = await supabase.from("lineups").update({ bow_number: value }).eq("id", lineupId);
  if (error) throw new Error(error.message);
  revalidatePath("/race-day");
}

// Club settings are admin-only (RLS).
export async function saveLaunchMinutes(minutes: number) {
  const supabase = await requireRole(["admin"]);
  if (!LAUNCH_MINUTE_OPTIONS.includes(minutes)) throw new Error("Pick one of the listed times.");
  const { error } = await supabase
    .from("club_settings")
    .upsert({ key: LAUNCH_MINUTES_KEY, value: String(minutes) }, { onConflict: "key" });
  if (error) throw new Error(error.message);
  revalidatePath("/race-day");
}
