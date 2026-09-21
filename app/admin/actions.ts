"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { NAV_SECTIONS } from "@/lib/navSections";

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

  const enabledHrefs = new Set(formData.getAll("enabled_href").map(String));
  const disabledHrefs = NAV_SECTIONS.filter((s) => !enabledHrefs.has(s.href)).map((s) => s.href);

  const { error } = await supabase
    .from("club_settings")
    .upsert({ key: "nav_disabled_hrefs", value: JSON.stringify(disabledHrefs) }, { onConflict: "key" });

  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/admin");
}
