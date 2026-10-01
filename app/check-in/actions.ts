"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AttendanceStatus, Profile } from "@/lib/database.types";
import { ABSENCE_REASONS, todaysPracticeDate } from "@/lib/practiceAttendance";
import { UserError, tryAction } from "@/lib/userError";
import { canCoachCheckIn } from "@/lib/checkIns";

export async function checkIn() {
  return tryAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UserError("Not signed in.");

    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const callerRole = (callerProfile as Pick<Profile, "role"> | null)?.role;
    if (!(await canCoachCheckIn(user.id, callerRole))) {
      throw new UserError("Check-in isn't turned on for you. Your club's admins choose who checks in.");
    }

    const { error } = await supabase.from("coach_check_ins").insert({ profile_id: user.id });
    if (error) throw new Error(error.message);

    revalidatePath("/");
    revalidatePath(`/roster/${user.id}`);
  });
}

async function setPracticeAttendance(status: AttendanceStatus | null, reason: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UserError("Not signed in.");

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const callerRole = (callerProfile as Pick<Profile, "role"> | null)?.role;
  if (callerRole !== "rower" && callerRole !== "coxswain") {
    throw new UserError("Only rowers and coxswains can check in to practice.");
  }

  const practiceDate = todaysPracticeDate();
  const { error } = status
    ? await supabase.from("practice_attendance").upsert({
        profile_id: user.id,
        practice_date: practiceDate,
        status,
        reason,
        responded_at: new Date().toISOString(),
      })
    : await supabase
        .from("practice_attendance")
        .delete()
        .eq("profile_id", user.id)
        .eq("practice_date", practiceDate);
  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/coach/attendance");
}

export async function checkInToPractice() {
  return tryAction(async () => {
    await setPracticeAttendance("checked_in", null);
  });
}

export async function markAbsentFromPractice(reason: string) {
  return tryAction(async () => {
    if (!(ABSENCE_REASONS as readonly string[]).includes(reason)) {
      throw new UserError("Pick a reason.");
    }
    await setPracticeAttendance("absent", reason);
  });
}

// "Change" — clears today's answer so both buttons show again.
export async function clearPracticeAttendance() {
  await setPracticeAttendance(null, null);
}
