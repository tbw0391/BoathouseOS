"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatErgTime, parseConcept2Csv, parseErgTime, testDistance } from "@/lib/erg";
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

// A 2K or 5K test becomes the profile's time (which logs it in erg_times
// and spots PRs). Parents can't edit profiles, so this one column goes
// through the service key after the check above.
async function updateProfileTest(profileId: string, which: "2k" | "5k", seconds: number) {
  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update(which === "2k" ? { erg_2k_time: formatErgTime(seconds) } : { erg_5k_time: formatErgTime(seconds) })
    .eq("id", profileId);
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
  const supabase = await createClient();
  const { error, count } = await supabase.from("erg_workouts").delete({ count: "exact" }).eq("id", workoutId);
  if (error || !count) throw new UserError("Couldn't remove that workout.");
  revalidatePath("/workouts");
}

export async function importConcept2(profileId: string, csvText: string) {
  const supabase = await createClient();
  const user = await requireActFor(supabase, profileId);
  if (csvText.length > 5_000_000) throw new UserError("That file is too big.");
  const rows = parseConcept2Csv(csvText);
  if (rows.length === 0) throw new UserError("That doesn't look like a Concept2 logbook export.");

  const { data: existing } = await supabase
    .from("erg_workouts")
    .select("source_ref")
    .eq("profile_id", profileId)
    .not("source_ref", "is", null);
  const have = new Set(((existing as { source_ref: string }[] | null) ?? []).map((r) => r.source_ref));
  const fresh = rows.filter((r) => !have.has(r.sourceRef));

  for (let i = 0; i < fresh.length; i += 500) {
    const { error } = await supabase.from("erg_workouts").insert(
      fresh.slice(i, i + 500).map((r) => ({
        profile_id: profileId,
        done_on: r.doneOn,
        piece: r.piece,
        distance_m: r.distanceM,
        time_seconds: r.timeSeconds,
        stroke_rate: r.strokeRate,
        notes: r.notes?.slice(0, 500) ?? null,
        source: "concept2",
        source_ref: r.sourceRef,
        entered_by: user.id,
      }))
    );
    if (error) throw new Error(error.message);
  }

  // The newest imported 2K/5K test, if it's newer than any logged before.
  for (const which of ["2k", "5k"] as const) {
    const newest = fresh
      .filter((r) => testDistance(r.distanceM, r.piece) === which && r.timeSeconds != null)
      .sort((a, b) => b.doneOn.localeCompare(a.doneOn))[0];
    if (!newest) continue;
    const { data: later } = await supabase
      .from("erg_workouts")
      .select("id")
      .eq("profile_id", profileId)
      .eq("distance_m", which === "2k" ? 2000 : 5000)
      .gt("done_on", newest.doneOn)
      .limit(1);
    if (!(later as { id: string }[] | null)?.length) await updateProfileTest(profileId, which, newest.timeSeconds!);
  }

  revalidatePath("/workouts");
  return { added: fresh.length, skipped: rows.length - fresh.length };
}
