"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { syncConcept2 } from "@/lib/concept2";
import { parseConcept2Csv, parseErgTime, testDistance } from "@/lib/erg";
import { saveImportedWorkouts, updateProfileTest } from "@/lib/ergImport";
import { UserError, tryAction } from "@/lib/userError";

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function requireActFor(supabase: Supabase, profileId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UserError("Not signed in.");
  const { data: ok } = await supabase.rpc("can_act_for", { person: profileId });
  if (!ok) throw new UserError("You can only log workouts for yourself or your own rower.");
  return user;
}

export async function logWorkout(
  profileId: string,
  input: { doneOn: string; piece: string; distanceM: number | null; timeText: string; strokeRate: number | null; notes: string }
) {
  return tryAction(async () => {
    const supabase = await createClient();
    const user = await requireActFor(supabase, profileId);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.doneOn)) throw new UserError("Pick the date.");
    const piece = input.piece.trim().slice(0, 60);
    if (!piece) throw new UserError("Pick what you rowed.");
    const seconds = input.timeText.trim() ? parseErgTime(input.timeText) : null;
    if (input.timeText.trim() && seconds == null) throw new UserError("Enter the time like 6:45.2.");
    const distance = input.distanceM != null && Number.isFinite(input.distanceM) && input.distanceM > 0 ? Math.round(input.distanceM) : null;
    if (distance == null && seconds == null) throw new UserError("Enter a time or a distance.");
    const rate = input.strokeRate != null && input.strokeRate >= 10 && input.strokeRate <= 60 ? Math.round(input.strokeRate) : null;

    const { error } = await supabase.from("erg_workouts").insert({
      profile_id: profileId,
      done_on: input.doneOn,
      piece,
      distance_m: distance,
      time_seconds: seconds,
      stroke_rate: rate,
      notes: input.notes.trim().slice(0, 500) || null,
      entered_by: user.id,
    });
    if (error) throw new Error(error.message);

    const test = testDistance(distance, piece);
    if (test && seconds != null) await updateProfileTest(profileId, test, seconds);
    revalidatePath("/workouts");
  });
}

export async function deleteWorkout(workoutId: string) {
  return tryAction(async () => {
    const supabase = await createClient();
    const { error, count } = await supabase.from("erg_workouts").delete({ count: "exact" }).eq("id", workoutId);
    if (error || !count) throw new UserError("Couldn't remove that workout.");
    revalidatePath("/workouts");
  });
}

export async function importConcept2(profileId: string, csvText: string) {
  return tryAction(async () => {
    const supabase = await createClient();
    const user = await requireActFor(supabase, profileId);
    if (csvText.length > 5_000_000) throw new UserError("That file is too big.");
    const rows = parseConcept2Csv(csvText);
    if (rows.length === 0) throw new UserError("That doesn't look like a Concept2 logbook export.");

    const result = await saveImportedWorkouts(supabase, profileId, rows, user.id);
    revalidatePath("/workouts");
    return result;
  });
}

// Concept2 automatic sync (lib/concept2.ts): pull new pieces now, or stop.
export async function syncConcept2Now(profileId: string) {
  return tryAction(async () => {
    const supabase = await createClient();
    await requireActFor(supabase, profileId);
    const result = await syncConcept2(profileId);
    if (!result) throw new UserError("Connect Concept2 first.");
    revalidatePath("/workouts");
    return result;
  });
}

export async function disconnectConcept2(profileId: string) {
  return tryAction(async () => {
    const supabase = await createClient();
    await requireActFor(supabase, profileId);
    const { error } = await createAdminClient().from("concept2_links").delete().eq("profile_id", profileId);
    if (error) throw new Error(error.message);
    revalidatePath("/workouts");
  });
}
