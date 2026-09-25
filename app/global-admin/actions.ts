"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// The database functions check global-admin status themselves (see
// migration 0058), so these just call through.
export async function saveDemoBaseline() {
  const supabase = await createClient();
  const { error } = await supabase.rpc("demo_save_baseline");
  if (error) throw new Error(error.message);
  revalidatePath("/global-admin");
}

export async function resetDemo(formData: FormData) {
  if (formData.get("confirm") !== "on") {
    throw new Error("Tick the confirmation box to reset the demo.");
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("demo_reset");
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}
