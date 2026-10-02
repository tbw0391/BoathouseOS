"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { clubDateTime } from "@/lib/ical";
import { boathouseError } from "@/lib/boathouse";
import { UserError, tryAction } from "@/lib/userError";

// Booking, signing out and in run through database functions (0128) that
// check ratings, swim tests, double-bookings and who's allowed; their
// refusals are written for people and shown as-is.

function fail(message: string): never {
  const friendly = boathouseError(message);
  if (friendly) throw new UserError(friendly);
  throw new Error(message);
}

const done = () => revalidatePath("/boathouse");

async function requireStaff(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.rpc("is_coach_or_admin");
  if (!data) throw new UserError("Only coaches and admins can change this.");
}

export async function bookEquipment(input: {
  boatId: string | null;
  ergId: string | null;
  date: string;
  time: string;
  minutes: number;
  rowerIds: string[];
  note: string;
}) {
  return tryAction(async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !/^\d{2}:\d{2}$/.test(input.time)) {
      throw new UserError("Pick a day and time.");
    }
    if (!Number.isInteger(input.minutes) || input.minutes < 15 || input.minutes > 360) {
      throw new UserError("Pick how long.");
    }
    const starts = clubDateTime(input.date, input.time);
    const ends = new Date(starts.getTime() + input.minutes * 60000);
    const supabase = await createClient();
    const { error } = await supabase.rpc("book_equipment", {
      boat: input.boatId,
      erg: input.ergId,
      starts: starts.toISOString(),
      ends: ends.toISOString(),
      rowers: input.rowerIds,
      note: input.note,
    });
    if (error) fail(error.message);
    done();
  });
}

export async function cancelReservation(id: string) {
  return tryAction(async () => {
    const supabase = await createClient();
    const { error, count } = await supabase.from("boat_reservations").delete({ count: "exact" }).eq("id", id);
    if (error) throw new Error(error.message);
    if (!count) throw new UserError("You can only cancel your own bookings.");
    done();
  });
}

export async function signOutBoat(input: { boatId: string; rowerIds: string[]; backTime: string; route: string }) {
  return tryAction(async () => {
    if (!/^\d{2}:\d{2}$/.test(input.backTime)) throw new UserError("Pick when you'll be back.");
    const now = new Date();
    const today = now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    let back = clubDateTime(today, input.backTime);
    // A time earlier than now means after midnight.
    if (back.getTime() <= now.getTime()) back = new Date(back.getTime() + 24 * 3600000);
    const supabase = await createClient();
    const { error } = await supabase.rpc("sign_out_boat", {
      boat: input.boatId,
      rowers: input.rowerIds,
      back_by: back.toISOString(),
      route_text: input.route,
    });
    if (error) fail(error.message);
    done();
  });
}

export async function signInBoat(signoutId: string, km: number | null, damage: string) {
  return tryAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase.rpc("sign_in_boat", { signout: signoutId, km, damage_text: damage });
    if (error) fail(error.message);
    done();
    revalidatePath("/boats");
    if (damage.trim()) revalidatePath("/boat-maintenance");
  });
}

export async function setBoatBooking(
  boatId: string,
  changes: { bookable?: boolean; min_rating?: number; out_of_service?: boolean }
) {
  return tryAction(async () => {
    const supabase = await createClient();
    await requireStaff(supabase);
    if (changes.min_rating !== undefined && ![0, 1, 2, 3].includes(changes.min_rating)) {
      throw new UserError("Pick a level.");
    }
    const { error } = await supabase.from("boats").update(changes).eq("id", boatId);
    if (error) throw new Error(error.message);
    done();
  });
}

export async function addErg(name: string) {
  return tryAction(async () => {
    const supabase = await createClient();
    await requireStaff(supabase);
    const clean = name.trim().slice(0, 40);
    if (!clean) throw new UserError("Name the erg (e.g. \"Erg 1\").");
    const { error } = await supabase.from("ergs").insert({ name: clean });
    if (error) throw new Error(error.message);
    done();
  });
}

export async function updateErg(ergId: string, changes: { bookable?: boolean; out_of_service?: boolean }) {
  return tryAction(async () => {
    const supabase = await createClient();
    await requireStaff(supabase);
    const { error } = await supabase.from("ergs").update(changes).eq("id", ergId);
    if (error) throw new Error(error.message);
    done();
  });
}

export async function removeErg(ergId: string) {
  return tryAction(async () => {
    const supabase = await createClient();
    await requireStaff(supabase);
    const { error } = await supabase.from("ergs").delete().eq("id", ergId);
    if (error) throw new Error(error.message);
    done();
  });
}

export async function setRating(profileId: string, rating: number) {
  return tryAction(async () => {
    if (![0, 1, 2, 3].includes(rating)) throw new UserError("Pick a level.");
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await requireStaff(supabase);
    const { error } = await supabase
      .from("member_ratings")
      .upsert({ profile_id: profileId, rating, rated_by: user?.id ?? null, rated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    revalidatePath(`/roster/${profileId}`);
    done();
  });
}
