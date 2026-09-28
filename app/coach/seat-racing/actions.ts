"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BOAT_CLASSES } from "@/lib/boatClasses";
import { parseErgTime } from "@/lib/erg";

async function requireManager() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = (data as { role: string } | null)?.role;
  if (role !== "coach" && role !== "admin") throw new Error("Only coaches and admins can run seat races.");
  return { supabase, user };
}

export async function createSeatRace(formData: FormData) {
  const { supabase, user } = await requireManager();
  const title = String(formData.get("title") ?? "").trim().slice(0, 80) || "Seat racing";
  const boatClass = String(formData.get("boat_class") ?? "");
  if (!BOAT_CLASSES[boatClass]) throw new Error("Pick the boat.");
  const racedOn = String(formData.get("raced_on") ?? "");
  const distance = Number(formData.get("distance_m"));
  const { data, error } = await supabase
    .from("seat_races")
    .insert({
      title,
      boat_class: boatClass,
      raced_on: /^\d{4}-\d{2}-\d{2}$/.test(racedOn) ? racedOn : new Date().toISOString().slice(0, 10),
      distance_m: Number.isFinite(distance) && distance > 0 ? Math.round(distance) : null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  redirect(`/coach/seat-racing/${(data as { id: string }).id}`);
}

export async function deleteSeatRace(raceId: string) {
  const { supabase } = await requireManager();
  await supabase.from("seat_races").delete().eq("id", raceId);
  redirect("/coach/seat-racing");
}

export async function addPiece(raceId: string, boatA: string[], boatB: string[]) {
  const { supabase } = await requireManager();
  if (boatA.length === 0 || boatB.length === 0) throw new Error("Put rowers in both boats.");
  if (boatA.some((r) => boatB.includes(r))) throw new Error("Someone is in both boats.");
  const { data: last } = await supabase
    .from("seat_race_pieces")
    .select("piece_no")
    .eq("seat_race_id", raceId)
    .order("piece_no", { ascending: false })
    .limit(1);
  const next = ((last as { piece_no: number }[] | null)?.[0]?.piece_no ?? 0) + 1;
  const { error } = await supabase.from("seat_race_pieces").insert({ seat_race_id: raceId, piece_no: next, boat_a: boatA, boat_b: boatB });
  if (error) throw new Error(error.message);
  revalidatePath(`/coach/seat-racing/${raceId}`);
}

export async function setPieceTimes(raceId: string, pieceId: string, timeA: string, timeB: string) {
  const { supabase } = await requireManager();
  const a = timeA.trim() ? parseErgTime(timeA) : null;
  const b = timeB.trim() ? parseErgTime(timeB) : null;
  if ((timeA.trim() && a == null) || (timeB.trim() && b == null)) throw new Error("Enter times like 7:02.4.");
  const { error } = await supabase.from("seat_race_pieces").update({ time_a: a, time_b: b }).eq("id", pieceId);
  if (error) throw new Error(error.message);
  revalidatePath(`/coach/seat-racing/${raceId}`);
}

export async function deletePiece(raceId: string, pieceId: string) {
  const { supabase } = await requireManager();
  await supabase.from("seat_race_pieces").delete().eq("id", pieceId);
  revalidatePath(`/coach/seat-racing/${raceId}`);
}
