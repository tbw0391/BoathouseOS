"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { UserError } from "@/lib/userError";

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
    throw new UserError("Tick the confirmation box to reset the demo.");
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("demo_reset");
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

// Error reports (0100) have no update policy, so these check global-admin
// status here and write with the service role.
async function requireGlobalAdmin() {
  const supabase = await createClient();
  const { data: isGlobalAdmin } = await supabase.rpc("is_global_admin");
  if (!isGlobalAdmin) throw new UserError("Only a global admin can do that.");
}

export async function markErrorFixed(formData: FormData) {
  await requireGlobalAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new UserError("Missing error.");
  const { error } = await createAdminClient()
    .from("error_reports")
    .update({ resolved_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/global-admin/errors");
}

export async function clearFixedErrors() {
  await requireGlobalAdmin();
  const { error } = await createAdminClient().from("error_reports").delete().not("resolved_at", "is", null);
  if (error) throw new Error(error.message);
  revalidatePath("/global-admin/errors");
}
