"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { UserError } from "@/lib/userError";

async function requireManager() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UserError("Not signed in.");
  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = (data as { role: string } | null)?.role;
  if (role !== "coach" && role !== "admin") throw new UserError("Only coaches and admins can change this.");
  return supabase;
}

export async function setServiceInterval(boatId: string, km: number | null) {
  const supabase = await requireManager();
  const value = km != null && Number.isInteger(km) && km > 0 && km <= 100000 ? km : null;
  const { error } = await supabase.from("boats").update({ service_every_km: value }).eq("id", boatId);
  if (error) throw new Error(error.message);
  revalidatePath("/boats");
}

export async function markServiced(boatId: string) {
  const supabase = await requireManager();
  const { error } = await supabase.from("boats").update({ last_service_at: new Date().toISOString() }).eq("id", boatId);
  if (error) throw new Error(error.message);
  revalidatePath("/boats");
}
