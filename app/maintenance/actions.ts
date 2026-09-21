"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { MaintenanceType } from "@/lib/database.types";

const PATH_BY_TYPE: Record<MaintenanceType, string> = {
  boat: "/boat-maintenance",
  site: "/site-maintenance",
};

export async function submitMaintenanceRequest(type: MaintenanceType, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const description = String(formData.get("description") ?? "").trim();
  const boatId = String(formData.get("boat_id") ?? "").trim() || null;

  if (!description) throw new Error("Describe the issue first.");
  if (type === "boat" && !boatId) throw new Error("Please choose a boat.");

  const { error } = await supabase.from("maintenance_requests").insert({
    type,
    boat_id: type === "boat" ? boatId : null,
    description,
    submitted_by: user.id,
  });

  if (error) throw new Error(error.message);

  revalidatePath(PATH_BY_TYPE[type]);
}

async function requireStaff(supabase: Awaited<ReturnType<typeof createClient>>) {
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
  if (callerRole !== "admin" && callerRole !== "coach") {
    throw new Error("Only coaches and admins can manage maintenance requests.");
  }
}

export async function markResolved(
  type: MaintenanceType,
  requestId: string,
  resolved: boolean
) {
  const supabase = await createClient();
  await requireStaff(supabase);

  const { error } = await supabase
    .from("maintenance_requests")
    .update({
      status: resolved ? "resolved" : "open",
      resolved_at: resolved ? new Date().toISOString() : null,
    })
    .eq("id", requestId);

  if (error) throw new Error(error.message);

  revalidatePath(PATH_BY_TYPE[type]);
}

export async function deleteMaintenanceRequest(type: MaintenanceType, requestId: string) {
  const supabase = await createClient();
  await requireStaff(supabase);

  const { error } = await supabase.from("maintenance_requests").delete().eq("id", requestId);
  if (error) throw new Error(error.message);

  revalidatePath(PATH_BY_TYPE[type]);
}
