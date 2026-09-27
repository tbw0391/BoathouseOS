"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/database.types";
import { isOnWaterColor } from "@/lib/onWaterColors";

export async function startSession(boatId: string, color: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if ((callerProfile as Pick<Profile, "role"> | null)?.role !== "coxswain") {
    throw new Error("Only coxswains can turn on GPS tracking.");
  }

  const { data: boat } = await supabase.from("boats").select("id").eq("id", boatId).maybeSingle();
  if (!boat) throw new Error("Pick which boat you're in.");
  if (!isOnWaterColor(color)) throw new Error("Pick a color.");

  // A phone left tracking from an earlier outing would show twice on the map.
  await supabase
    .from("on_water_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("coxswain_id", user.id)
    .is("ended_at", null);

  const { data, error } = await supabase
    .from("on_water_sessions")
    .insert({ coxswain_id: user.id, boat_id: boatId, color })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/on-water");
  revalidatePath("/coach/tracking");
  return data.id as string;
}

export async function endSession(sessionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { error } = await supabase
    .from("on_water_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", sessionId);

  if (error) throw new Error(error.message);

  revalidatePath("/on-water");
  revalidatePath("/coach/tracking");
}
