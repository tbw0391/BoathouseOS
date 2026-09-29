"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ROOKIE_PARENT_SECTIONS } from "@/lib/rookieParent";
import { UserError, tryAction } from "@/lib/userError";

export async function updateRookieParentSection(key: string, text: string) {
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
    if ((callerProfile as { role: string } | null)?.role !== "admin") {
      throw new UserError("Only admins can edit this page.");
    }

    if (!ROOKIE_PARENT_SECTIONS.some((s) => s.key === key)) throw new UserError("Unknown section.");

    const { error } = await supabase
      .from("club_settings")
      .upsert({ key, value: text.trim() || null }, { onConflict: "key" });
    if (error) throw new Error(error.message);

    revalidatePath("/rookie-parent");
  });
}
