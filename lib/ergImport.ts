import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { clubIdOf } from "@/lib/clubs";
import { formatErgTime, testDistance, type ImportedWorkout } from "@/lib/erg";

// Saving imported Concept2 pieces, shared by the CSV upload and the
// automatic sync (lib/concept2.ts).

// A 2K or 5K test becomes the profile's time (which logs it in erg_times
// and spots PRs). Parents can't edit profiles, so this one column goes
// through the service key; callers check who's allowed first.
export async function updateProfileTest(profileId: string, which: "2k" | "5k", seconds: number) {
  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update(which === "2k" ? { erg_2k_time: formatErgTime(seconds) } : { erg_5k_time: formatErgTime(seconds) })
    .eq("id", profileId);
}

// Adds the pieces this profile doesn't have yet (matched on source_ref),
// then moves the profile's 2K/5K to the newest imported test if nothing
// later was logged. `db` is the member's own client for an upload, or the
// service role for the sync.
export async function saveImportedWorkouts(
  db: SupabaseClient,
  profileId: string,
  rows: ImportedWorkout[],
  enteredBy: string | null
): Promise<{ added: number; skipped: number }> {
  const { data: existing } = await db
    .from("erg_workouts")
    .select("source_ref")
    .eq("profile_id", profileId)
    .not("source_ref", "is", null);
  const have = new Set(((existing as { source_ref: string }[] | null) ?? []).map((r) => r.source_ref));
  const seen = new Set<string>();
  const fresh = rows.filter((r) => {
    if (have.has(r.sourceRef) || seen.has(r.sourceRef)) return false;
    seen.add(r.sourceRef);
    return true;
  });

  const clubId = fresh.length ? await clubIdOf(createAdminClient(), profileId) : null;
  for (let i = 0; i < fresh.length; i += 500) {
    const { error } = await db.from("erg_workouts").insert(
      fresh.slice(i, i + 500).map((r) => ({
        club_id: clubId,
        profile_id: profileId,
        done_on: r.doneOn,
        piece: r.piece,
        distance_m: r.distanceM,
        time_seconds: r.timeSeconds,
        stroke_rate: r.strokeRate,
        notes: r.notes?.slice(0, 500) ?? null,
        source: "concept2",
        source_ref: r.sourceRef,
        entered_by: enteredBy,
      }))
    );
    if (error) throw new Error(error.message);
  }

  for (const which of ["2k", "5k"] as const) {
    const newest = fresh
      .filter((r) => testDistance(r.distanceM, r.piece) === which && r.timeSeconds != null)
      .sort((a, b) => b.doneOn.localeCompare(a.doneOn))[0];
    if (!newest) continue;
    const { data: later } = await db
      .from("erg_workouts")
      .select("id")
      .eq("profile_id", profileId)
      .eq("distance_m", which === "2k" ? 2000 : 5000)
      .gt("done_on", newest.doneOn)
      .limit(1);
    if (!(later as { id: string }[] | null)?.length) await updateProfileTest(profileId, which, newest.timeSeconds!);
  }

  return { added: fresh.length, skipped: rows.length - fresh.length };
}
