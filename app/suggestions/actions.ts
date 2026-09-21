"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function submitSuggestion(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const body = String(formData.get("body") ?? "").trim();
  if (!body) throw new Error("Write your suggestion first.");

  const { error } = await supabase
    .from("suggestions")
    .insert({ submitted_by: user.id, body });

  if (error) throw new Error(error.message);

  revalidatePath("/suggestions");
}

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
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
    throw new Error("Only admins can manage suggestions.");
  }
}

export async function markReviewed(suggestionId: string, reviewed: boolean) {
  const supabase = await createClient();
  await requireAdmin(supabase);

  const { error } = await supabase
    .from("suggestions")
    .update({ status: reviewed ? "reviewed" : "new" })
    .eq("id", suggestionId);

  if (error) throw new Error(error.message);

  revalidatePath("/suggestions");
}

export async function deleteSuggestion(suggestionId: string) {
  const supabase = await createClient();
  await requireAdmin(supabase);

  const { error } = await supabase.from("suggestions").delete().eq("id", suggestionId);
  if (error) throw new Error(error.message);

  revalidatePath("/suggestions");
}
