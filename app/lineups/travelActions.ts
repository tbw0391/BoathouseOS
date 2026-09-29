"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { clubDateTime } from "@/lib/ical";
import { UserError } from "@/lib/userError";

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function me(supabase: Supabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UserError("Not signed in.");
  const { data } = await supabase.from("profiles").select("role, display_name").eq("id", user.id).single();
  const profile = data as { role: string; display_name: string } | null;
  return { user, isManager: profile?.role === "coach" || profile?.role === "admin", name: profile?.display_name ?? "" };
}

async function requireManager(supabase: Supabase) {
  const who = await me(supabase);
  if (!who.isManager) throw new UserError("Only coaches and admins can change this.");
  return who;
}

const done = (eventId: string) => revalidatePath(`/lineups/${eventId}`);

// "2026-10-03T06:30" from a datetime-local input, read as club time.
function clubInput(value: FormDataEntryValue | null): string | null {
  const v = String(value ?? "").trim();
  const m = v.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/);
  return m ? clubDateTime(m[1], m[2]).toISOString() : null;
}

const text = (value: FormDataEntryValue | null, max: number) => String(value ?? "").trim().slice(0, max) || null;

export async function saveTripDetails(eventId: string, formData: FormData) {
  const supabase = await createClient();
  await requireManager(supabase);
  const { error } = await supabase.from("regatta_travel").upsert({
    event_id: eventId,
    depart_at: clubInput(formData.get("depart_at")),
    depart_from: text(formData.get("depart_from"), 120),
    return_at: clubInput(formData.get("return_at")),
    hotel_name: text(formData.get("hotel_name"), 120),
    hotel_address: text(formData.get("hotel_address"), 200),
    notes: text(formData.get("notes"), 2000),
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  done(eventId);
}

// A coach adds a bus or van; anyone offers their own car.
export async function addVehicle(eventId: string, label: string, seats: number, asDriver: boolean) {
  const supabase = await createClient();
  const who = await me(supabase);
  if (!asDriver && !who.isManager) throw new UserError("Only coaches and admins can add a bus.");
  if (!Number.isInteger(seats) || seats < 1 || seats > 80) throw new UserError("Pick how many seats.");
  const name = label.trim().slice(0, 60) || `${who.name.split(" ")[0]}'s car`;
  const { error } = await supabase.from("travel_vehicles").insert({
    event_id: eventId,
    label: name,
    seats,
    driver_id: asDriver ? who.user.id : null,
    created_by: who.user.id,
  });
  if (error) throw new Error(error.message);
  done(eventId);
}

export async function removeVehicle(eventId: string, vehicleId: string) {
  const supabase = await createClient();
  await me(supabase);
  // RLS lets coaches/admins remove any ride and drivers their own.
  const { error, count } = await supabase.from("travel_vehicles").delete({ count: "exact" }).eq("id", vehicleId);
  if (error) throw new Error(error.message);
  if (!count) throw new UserError("You can only remove your own car.");
  done(eventId);
}

export async function takeSeat(eventId: string, vehicleId: string, personId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("take_travel_seat", { vehicle: vehicleId, person: personId });
  if (error) throw new Error(error.message);
  done(eventId);
}

export async function leaveSeat(eventId: string, vehicleId: string, personId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_travel_seat", { vehicle: vehicleId, person: personId });
  if (error) throw new Error(error.message);
  done(eventId);
}

export async function addRoom(eventId: string, label: string, capacity: number) {
  const supabase = await createClient();
  await requireManager(supabase);
  const { error } = await supabase
    .from("travel_rooms")
    .insert({ event_id: eventId, label: label.trim().slice(0, 60) || "Room", capacity });
  if (error) throw new Error(error.message);
  done(eventId);
}

export async function removeRoom(eventId: string, roomId: string) {
  const supabase = await createClient();
  await requireManager(supabase);
  const { error } = await supabase.from("travel_rooms").delete().eq("id", roomId);
  if (error) throw new Error(error.message);
  done(eventId);
}

export async function setRoom(eventId: string, roomId: string | null, personId: string) {
  const supabase = await createClient();
  await requireManager(supabase);
  await supabase.from("travel_room_members").delete().eq("event_id", eventId).eq("profile_id", personId);
  if (roomId) {
    const { data: room } = await supabase.from("travel_rooms").select("capacity").eq("id", roomId).single();
    const { count } = await supabase
      .from("travel_room_members")
      .select("profile_id", { count: "exact", head: true })
      .eq("room_id", roomId);
    if ((count ?? 0) >= ((room as { capacity: number } | null)?.capacity ?? 0)) throw new UserError("That room is full.");
    const { error } = await supabase
      .from("travel_room_members")
      .insert({ room_id: roomId, event_id: eventId, profile_id: personId });
    if (error) throw new Error(error.message);
  }
  done(eventId);
}
