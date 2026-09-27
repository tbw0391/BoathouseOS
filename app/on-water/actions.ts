"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardianIdsFor, sendPush } from "@/lib/push";
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
  const role = (callerProfile as Pick<Profile, "role"> | null)?.role;
  // Admins can cox too.
  if (role !== "coxswain" && role !== "admin") {
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
  const sessionId = data.id as string;
  after(() => alertCrewFamilies(sessionId, boatId, user.id));
  return sessionId;
}

// Tells the crew's parents their boat is out (everyone seated in today's
// lineup for this boat, if there is one, plus the coxswain), and anyone
// following the boat on the On the Water page.
async function alertCrewFamilies(sessionId: string, boatId: string, coxswainId: string) {
  const admin = createAdminClient();

  // Restarting tracking shouldn't alert everyone twice.
  const { count: recentStarts } = await admin
    .from("on_water_sessions")
    .select("id", { count: "exact", head: true })
    .eq("boat_id", boatId)
    .neq("id", sessionId)
    .gte("started_at", new Date(Date.now() - 30 * 60 * 1000).toISOString());
  if ((recentStarts ?? 0) > 0) return;

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const [{ data: boat }, { data: coxswain }, { data: lineupsData }] = await Promise.all([
    admin.from("boats").select("name").eq("id", boatId).single(),
    admin.from("profiles").select("display_name").eq("id", coxswainId).single(),
    admin.from("lineups").select("id, schedule_events(starts_at)").eq("boat_id", boatId),
  ]);
  const todaysLineupIds = ((lineupsData as unknown as
    | { id: string; schedule_events: { starts_at: string } | null }[]
    | null) ?? [])
    .filter(
      (l) =>
        l.schedule_events &&
        new Date(l.schedule_events.starts_at).toLocaleDateString("en-CA", { timeZone: "America/New_York" }) ===
          today
    )
    .map((l) => l.id);

  const { data: seats } = todaysLineupIds.length
    ? await admin.from("lineup_seats").select("rower_id").in("lineup_id", todaysLineupIds)
    : { data: [] };
  const crew = [
    ...new Set([
      coxswainId,
      ...((seats as { rower_id: string | null }[] | null) ?? [])
        .map((s) => s.rower_id)
        .filter((id): id is string => Boolean(id)),
    ]),
  ];

  const { data: followers } = await admin.from("on_water_follows").select("profile_id").eq("boat_id", boatId);

  const boatName = (boat as { name: string } | null)?.name ?? "A boat";
  const coxName = (coxswain as { display_name: string } | null)?.display_name;
  await sendPush(
    [
      ...(await guardianIdsFor(crew)),
      ...((followers as { profile_id: string }[] | null) ?? []).map((f) => f.profile_id),
    ].filter((id) => id !== coxswainId),
    {
      kind: "boat_on_water",
      title: `${boatName} is on the water`,
      body: `${coxName ? `Coxed by ${coxName}. ` : ""}Tap to watch live.`,
      url: "/on-water",
      tag: `water-${sessionId}`,
    }
  );
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

export async function setBoatFollowed(boatId: string, follow: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { error } = follow
    ? await supabase
        .from("on_water_follows")
        .upsert({ profile_id: user.id, boat_id: boatId }, { onConflict: "profile_id,boat_id", ignoreDuplicates: true })
    : await supabase.from("on_water_follows").delete().eq("profile_id", user.id).eq("boat_id", boatId);
  if (error) throw new Error(error.message);
}
