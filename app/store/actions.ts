"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateStoreLink(formData: FormData) {
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

  const callerRole = (callerProfile as { role: string } | null)?.role;
  if (callerRole !== "admin") {
    throw new Error("Only admins can change the team store link.");
  }

  const url = String(formData.get("url") ?? "").trim();

  const { error } = await supabase
    .from("club_settings")
    .update({ value: url || null })
    .eq("key", "team_store_url");

  if (error) throw new Error(error.message);

  revalidatePath("/store");
}
