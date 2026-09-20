"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateStoreLink(formData: FormData) {
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

  const callerRole = (callerProfile as { role: string } | null)?.role;
  if (callerRole !== "admin") {
    throw new Error("Only admins can change the team store link.");
  }

  const url = String(formData.get("url") ?? "").trim();

  const { error } = await supabase
    .from("club_settings")
    .update({ value: url || null })
    .eq("key", "team_store_url");

  if (error) throw new Error(error.message);

  revalidatePath("/store");
}

export async function updateFeaturedItems(formData: FormData) {
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

  const callerRole = (callerProfile as { role: string } | null)?.role;
  if (callerRole !== "admin") {
    throw new Error("Only admins can change the featured store items.");
  }

  const itemsRaw = String(formData.get("items") ?? "[]");
  let items: unknown;
  try {
    items = JSON.parse(itemsRaw);
  } catch {
    throw new Error("Invalid items payload.");
  }
  if (!Array.isArray(items)) throw new Error("Invalid items payload.");

  const cleaned = items
    .map((item) => ({
      title: String(item?.title ?? "").trim(),
      price: String(item?.price ?? "").trim(),
      url: String(item?.url ?? "").trim(),
      image_url: String(item?.image_url ?? "").trim(),
    }))
    .filter((item) => item.title && item.url);

  const { error } = await supabase
    .from("club_settings")
    .upsert({ key: "team_store_featured_items", value: JSON.stringify(cleaned) }, { onConflict: "key" });

  if (error) throw new Error(error.message);

  revalidatePath("/store");
  revalidatePath("/");
}
