"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { TRAILER_KIND_ORDER, type TrailerKind, type TrailerLeg } from "@/lib/trailer";
import type { Lineup, TrailerItem } from "@/lib/database.types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function requireManager(supabase: Supabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = (data as { role: string } | null)?.role;
  if (role !== "coach" && role !== "admin") throw new Error("Only coaches and admins can change the trailer list.");
  return user;
}

async function insertItems(
  supabase: Supabase,
  eventId: string,
  userId: string,
  items: { label: string; kind: TrailerKind; boat_id?: string | null }[]
) {
  const { data: existing } = await supabase.from("trailer_items").select("label, sort").eq("event_id", eventId);
  const rows = (existing as Pick<TrailerItem, "label" | "sort">[] | null) ?? [];
  const have = new Set(rows.map((r) => r.label.toLowerCase()));
  let sort = rows.reduce((m, r) => Math.max(m, r.sort), 0);
  const fresh = items
    .map((i) => ({ ...i, label: i.label.trim().slice(0, 80) }))
    .filter((i) => i.label && TRAILER_KIND_ORDER.includes(i.kind) && !have.has(i.label.toLowerCase()))
    .filter((i, idx, all) => all.findIndex((j) => j.label.toLowerCase() === i.label.toLowerCase()) === idx)
    .map((i) => ({
      event_id: eventId,
      label: i.label,
      kind: i.kind,
      boat_id: i.boat_id ?? null,
      sort: ++sort,
      created_by: userId,
    }));
  if (fresh.length === 0) return 0;
  const { error } = await supabase.from("trailer_items").insert(fresh);
  if (error) throw new Error(error.message);
  return fresh.length;
}

export async function addTrailerItems(eventId: string, items: { label: string; kind: TrailerKind }[]) {
  const supabase = await createClient();
  const user = await requireManager(supabase);
  await insertItems(supabase, eventId, user.id, items);
  revalidatePath(`/lineups/${eventId}`);
}

// Every boat in this regatta's lineups, with its oars.
export async function addRacingBoats(eventId: string) {
  const supabase = await createClient();
  const user = await requireManager(supabase);
  const { data } = await supabase.from("lineups").select("boat_id, boat_name").eq("event_id", eventId);
  const boats = new Map<string, { label: string; boat_id: string | null }>();
  for (const l of (data as Pick<Lineup, "boat_id" | "boat_name">[] | null) ?? []) {
    if (l.boat_name && !boats.has(l.boat_name.toLowerCase())) {
      boats.set(l.boat_name.toLowerCase(), { label: l.boat_name, boat_id: l.boat_id });
    }
  }
  const added = await insertItems(supabase, eventId, user.id, [
    ...[...boats.values()].map((b) => ({ label: b.label, kind: "boat" as const, boat_id: b.boat_id })),
    ...[...boats.values()].map((b) => ({ label: `Oars for ${b.label}`, kind: "oars" as const })),
  ]);
  revalidatePath(`/lineups/${eventId}`);
  return added;
}

// The list from the most recent other regatta that had one, unticked.
export async function copyLastTrailerList(eventId: string) {
  const supabase = await createClient();
  const user = await requireManager(supabase);
  const { data: withLists } = await supabase.from("trailer_items").select("event_id").neq("event_id", eventId);
  const eventIds = [...new Set(((withLists as { event_id: string }[] | null) ?? []).map((r) => r.event_id))];
  if (eventIds.length === 0) return 0;
  const { data: last } = await supabase
    .from("schedule_events")
    .select("id")
    .in("id", eventIds)
    .order("starts_at", { ascending: false })
    .limit(1);
  const lastEventId = (last as { id: string }[] | null)?.[0]?.id;
  if (!lastEventId) return 0;
  const { data } = await supabase
    .from("trailer_items")
    .select("label, kind, boat_id")
    .eq("event_id", lastEventId)
    .order("sort");
  const added = await insertItems(
    supabase,
    eventId,
    user.id,
    (data as Pick<TrailerItem, "label" | "kind" | "boat_id">[] | null) ?? []
  );
  revalidatePath(`/lineups/${eventId}`);
  return added;
}

export async function removeTrailerItem(eventId: string, itemId: string) {
  const supabase = await createClient();
  await requireManager(supabase);
  const { error } = await supabase.from("trailer_items").delete().eq("id", itemId);
  if (error) throw new Error(error.message);
  revalidatePath(`/lineups/${eventId}`);
}

// Anyone in the club can tick items off.
export async function setTrailerItemPacked(eventId: string, itemId: string, leg: TrailerLeg, packed: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_trailer_item_packed", { item_id: itemId, leg, packed });
  if (error) throw new Error(error.message);
  revalidatePath(`/lineups/${eventId}`);
}
