"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { LineupSeat, Profile } from "@/lib/database.types";

async function requireEligibleCoxswain(
  supabase: Awaited<ReturnType<typeof createClient>>,
  lineupId: string | null
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const callerRole = (callerProfile as Pick<Profile, "role"> | null)?.role;
  if (callerRole === "coxswain") return { user };

  const { data: seatsData } = await supabase
    .from("lineup_seats")
    .select("*")
    .eq("seat_role", "coxswain")
    .eq("rower_id", user.id);
  const seats = (seatsData as LineupSeat[] | null) ?? [];
  const holdsCoxSeat = lineupId ? seats.some((s) => s.lineup_id === lineupId) : seats.length > 0;

  if (!holdsCoxSeat) {
    throw new Error("You don't have a coxswain assignment, so you can't start tracking.");
  }

  return { user };
}

export async function startSession(lineupId: string | null) {
  const supabase = await createClient();
  const { user } = await requireEligibleCoxswain(supabase, lineupId);

  const { data, error } = await supabase
    .from("on_water_sessions")
    .insert({ lineup_id: lineupId, coxswain_id: user.id })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/on-water");
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
