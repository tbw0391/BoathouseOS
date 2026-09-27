"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AttendanceStatus, Profile } from "@/lib/database.types";
import { ABSENCE_REASONS, todaysPracticeDate } from "@/lib/practiceAttendance";

export async function checkIn() {
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
  const callerRole = (callerProfile as Pick<Profile, "role"> | null)?.role;
  if (callerRole !== "coach" && callerRole !== "admin") {
    throw new Error("Only coaches and admins can check in.");
  }

  const { error } = await supabase.from("coach_check_ins").insert({ profile_id: user.id });
  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath(`/roster/${user.id}`);
}

async function setPracticeAttendance(status: AttendanceStatus | null, reason: string | null) {
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
  const callerRole = (callerProfile as Pick<Profile, "role"> | null)?.role;
  if (callerRole !== "rower" && callerRole !== "coxswain") {
    throw new Error("Only rowers and coxswains can check in to practice.");
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
  await setPracticeAttendance("checked_in", null);
}

export async function markAbsentFromPractice(reason: string) {
  if (!(ABSENCE_REASONS as readonly string[]).includes(reason)) {
    throw new Error("Pick a reason.");
  }
  await setPracticeAttendance("absent", reason);
}

// "Change" — clears today's answer so both buttons show again.
export async function clearPracticeAttendance() {
  await setPracticeAttendance(null, null);
}
