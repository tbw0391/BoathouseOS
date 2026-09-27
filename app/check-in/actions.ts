"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/database.types";

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
