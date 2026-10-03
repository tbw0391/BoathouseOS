"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { MaintenanceType } from "@/lib/database.types";
import { UserError, tryAction } from "@/lib/userError";

const PATH_BY_TYPE: Record<MaintenanceType, string> = {
  boat: "/boat-maintenance",
  site: "/site-maintenance",
};

export async function submitMaintenanceRequest(type: MaintenanceType, formData: FormData) {
  return tryAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UserError("Not signed in.");

    const description = String(formData.get("description") ?? "").trim();
    const boatId = String(formData.get("boat_id") ?? "").trim() || null;

    if (!description) throw new UserError("Describe the issue first.");
    if (type === "boat" && !boatId) throw new UserError("Please choose a boat.");

    const { error } = await supabase.from("maintenance_requests").insert({
      type,
      boat_id: type === "boat" ? boatId : null,
      description,
      submitted_by: user.id,
    });

    if (error) throw new Error(error.message);

    revalidatePath(PATH_BY_TYPE[type]);
  });
}

async function requireStaff(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UserError("Not signed in.");

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const callerRole = (callerProfile as { role: string } | null)?.role;
  if (callerRole !== "admin" && callerRole !== "coach") {
    throw new UserError("Only coaches and admins can manage maintenance requests.");
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

// Boats page switch (suggestion, 2026-09-23): "Needs maintenance" on a boat
// opens a boat maintenance request saying what needs doing, so it shows up
// on Boat Maintenance. "Mark fixed" resolves every open request for it.
export async function flagBoatMaintenance(boatId: string, description: string) {
  return tryAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UserError("Not signed in.");
    await requireStaff(supabase);

    const what = description.trim();
    if (!boatId) throw new UserError("Missing boat.");
    if (!what) throw new UserError("Say what needs to be done.");
    if (what.length > 1000) throw new UserError("Keep it under 1,000 characters.");

    const { error } = await supabase.from("maintenance_requests").insert({
      type: "boat",
      boat_id: boatId,
      description: what,
      submitted_by: user.id,
    });
    if (error) throw new Error(error.message);

    revalidatePath("/boats");
    revalidatePath("/boat-maintenance");
  });
}

export async function clearBoatMaintenance(boatId: string) {
  return tryAction(async () => {
    const supabase = await createClient();
    await requireStaff(supabase);
    if (!boatId) throw new UserError("Missing boat.");

    const { error } = await supabase
      .from("maintenance_requests")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("type", "boat")
      .eq("boat_id", boatId)
      .eq("status", "open");
    if (error) throw new Error(error.message);

    revalidatePath("/boats");
    revalidatePath("/boat-maintenance");
  });
}
