"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { NAV_SECTIONS, NAV_VISIBILITY_OPTIONS, type NavVisibility } from "@/lib/navSections";
import { LINEUP_SECTIONS } from "@/lib/lineupSections";
import { DEFAULT_THEME_COLORS, isHexColor, type ThemeColorKey } from "@/lib/theme";

export async function updateNavToggles(formData: FormData) {
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
  if ((callerProfile as { role: string } | null)?.role !== "admin") {
    throw new Error("Only admins can change which buttons are shown.");
  }

  const visibilityByHref: Record<string, NavVisibility> = {};
  for (const s of NAV_SECTIONS) {
    const raw = String(formData.get(`visibility:${s.href}`) ?? "everyone");
    visibilityByHref[s.href] = (NAV_VISIBILITY_OPTIONS as string[]).includes(raw)
      ? (raw as NavVisibility)
      : "everyone";
  }

  const { error } = await supabase
    .from("club_settings")
    .upsert({ key: "nav_visibility", value: JSON.stringify(visibilityByHref) }, { onConflict: "key" });

  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/admin");
}

export async function updateLineupSectionVisibility(formData: FormData) {
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
  if ((callerProfile as { role: string } | null)?.role !== "admin") {
    throw new Error("Only admins can change which lineup sections are shown.");
  }

  const visibilityById: Record<string, NavVisibility> = {};
  for (const s of LINEUP_SECTIONS) {
    const raw = String(formData.get(`visibility:${s.id}`) ?? "everyone");
    visibilityById[s.id] = (NAV_VISIBILITY_OPTIONS as string[]).includes(raw)
      ? (raw as NavVisibility)
      : "everyone";
  }

  const { error } = await supabase
    .from("club_settings")
    .upsert(
      { key: "lineup_section_visibility", value: JSON.stringify(visibilityById) },
      { onConflict: "key" }
    );

  if (error) throw new Error(error.message);

  revalidatePath("/lineups");
  revalidatePath("/admin");
}

export async function resetThemeColors() {
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
  if ((callerProfile as { role: string } | null)?.role !== "admin") {
    throw new Error("Only admins can change the site colors.");
  }

  const { error } = await supabase
    .from("club_settings")
    .upsert(
      { key: "theme_colors", value: JSON.stringify(DEFAULT_THEME_COLORS) },
      { onConflict: "key" }
    );

  if (error) throw new Error(error.message);

  revalidatePath("/", "layout");
}

export async function updateThemeColors(formData: FormData) {
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
  if ((callerProfile as { role: string } | null)?.role !== "admin") {
    throw new Error("Only admins can change the site colors.");
  }

  const colors: Record<ThemeColorKey, string> = { ...DEFAULT_THEME_COLORS };
  for (const key of Object.keys(DEFAULT_THEME_COLORS) as ThemeColorKey[]) {
    const raw = formData.get(`color:${key}`);
    if (isHexColor(raw)) colors[key] = raw;
  }

  const { error } = await supabase
    .from("club_settings")
    .upsert({ key: "theme_colors", value: JSON.stringify(colors) }, { onConflict: "key" });

  if (error) throw new Error(error.message);

  revalidatePath("/", "layout");
}
