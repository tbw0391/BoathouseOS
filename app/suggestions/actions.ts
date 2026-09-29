"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { SuggestionCategory } from "@/lib/database.types";
import { UserError, tryAction } from "@/lib/userError";

const VALID_CATEGORIES: SuggestionCategory[] = ["club", "app"];

export async function submitSuggestion(formData: FormData) {
  return tryAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UserError("Not signed in.");

    const body = String(formData.get("body") ?? "").trim();
    if (!body) throw new UserError("Write your suggestion first.");

    const category = String(formData.get("category") ?? "");
    if (!VALID_CATEGORIES.includes(category as SuggestionCategory)) {
      throw new UserError("Please choose whether this is about the club or the app.");
    }

    const { error } = await supabase
      .from("suggestions")
      .insert({ submitted_by: user.id, body, category });

    if (error) throw new Error(error.message);

    revalidatePath("/suggestions");
  });
}

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
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
  if (callerRole !== "admin") {
    throw new UserError("Only admins can manage suggestions.");
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
