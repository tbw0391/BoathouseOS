"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { TERMS_VERSION } from "@/lib/terms";
import { UserError, tryAction } from "@/lib/userError";

// Existing members agreeing to the current Terms (new ones do it at signup).
export async function acceptTerms() {
  return tryAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UserError("Not signed in.");

    const { error } = await supabase
      .from("profiles")
      .update({ terms_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION })
      .eq("id", user.id);
    if (error) throw new Error(error.message);

    revalidatePath("/", "layout");
  });
}
