"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { NAV_SECTIONS, NAV_VISIBILITY_OPTIONS, type NavVisibility } from "@/lib/navSections";

export async function updateNavToggles(formData: FormData) {
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
  if ((callerProfile as { role: string } | null)?.role !== "admin") {
    throw new Error("Only admins can change which buttons are shown.");
  }

  const visibilityByHref: Record<string, NavVisibility> = {};
  for (const s of NAV_SECTIONS) {
    const raw = String(formData.get(`visibility:${s.href}`) ?? "everyone");
    visibilityByHref[s.href] = (NAV_VISIBILITY_OPTIONS as string[]).includes(raw)
      ? (raw as NavVisibility)
      : "everyone";
  }

  const { error } = await supabase
    .from("club_settings")
    .upsert({ key: "nav_visibility", value: JSON.stringify(visibilityByHref) }, { onConflict: "key" });

  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/admin");
}
