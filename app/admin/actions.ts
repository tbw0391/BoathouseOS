"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  NAV_ACCESS_KEY,
  NAV_ROLES,
  NAV_VISIBILITY_OPTIONS,
  navSectionsFor,
  type NavRole,
  type NavVisibility,
} from "@/lib/navSections";
import { LINEUP_SECTIONS } from "@/lib/lineupSections";
import { DEFAULT_THEME_COLORS, isHexColor, type ThemeColorKey } from "@/lib/theme";
import { ALERT_SETTINGS_KEY, ALERT_TYPES } from "@/lib/alertSettings";

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

export async function updateAlertSettings(formData: FormData) {
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
    throw new Error("Only admins can change alerts.");
  }

  const enabled = Object.fromEntries(
    ALERT_TYPES.map((t) => [t.kind, formData.get(`alert:${t.kind}`) !== "off"])
  );

  const { error } = await supabase
    .from("club_settings")
    .upsert({ key: ALERT_SETTINGS_KEY, value: JSON.stringify(enabled) }, { onConflict: "key" });

  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/admin");
}

// Which home-screen buttons each type of user sees.
export async function updateNavAccess(access: Record<NavRole, string[]>) {
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

  const clean: Record<string, string[]> = {};
  for (const { role } of NAV_ROLES) {
    const allowed = new Set(navSectionsFor(role).map((s) => s.href));
    const list = Array.isArray(access?.[role]) ? access[role] : [];
    clean[role] = [...new Set(list.filter((href) => typeof href === "string" && allowed.has(href)))];
  }

  const { error } = await supabase
    .from("club_settings")
    .upsert({ key: NAV_ACCESS_KEY, value: JSON.stringify(clean) }, { onConflict: "key" });
  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/admin");
}
