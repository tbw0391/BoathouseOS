"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  NAV_ACCESS_KEY,
  NAV_KNOWN_KEY,
  NAV_ROLES,
  NAV_SECTIONS,
  NAV_VISIBILITY_OPTIONS,
  navSectionsFor,
  type NavRole,
  type NavVisibility,
} from "@/lib/navSections";
import { LINEUP_SECTIONS } from "@/lib/lineupSections";
import { DEFAULT_THEME_COLORS, isHexColor, type ThemeColorKey } from "@/lib/theme";
import { ALERT_SETTINGS_KEY, ALERT_TYPES } from "@/lib/alertSettings";
import { OAR_COLORS_KEY } from "@/lib/oarSheet";
import {
  PROFILE_BUTTONS,
  PROFILE_BUTTONS_KEY,
  PROFILE_GROUPS,
  PROFILE_KNOWN_KEY,
  profileButtonsFor,
  type ProfileGroup,
} from "@/lib/profileButtons";
import { UserError, tryAction } from "@/lib/userError";

export async function updateLineupSectionVisibility(formData: FormData) {
  return tryAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UserError("Not signed in.");

    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if ((callerProfile as { role: string } | null)?.role !== "admin") {
      throw new UserError("Only admins can change which lineup sections are shown.");
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
        { onConflict: "club_id,key" }
      );

    if (error) throw new Error(error.message);

    revalidatePath("/lineups");
    revalidatePath("/admin");
  });
}

export async function resetThemeColors() {
  return tryAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UserError("Not signed in.");

    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if ((callerProfile as { role: string } | null)?.role !== "admin") {
      throw new UserError("Only admins can change the site colors.");
    }

    const { error } = await supabase
      .from("club_settings")
      .upsert(
        { key: "theme_colors", value: JSON.stringify(DEFAULT_THEME_COLORS) },
        { onConflict: "club_id,key" }
      );

    if (error) throw new Error(error.message);

    revalidatePath("/", "layout");
  });
}

export async function updateThemeColors(formData: FormData) {
  return tryAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UserError("Not signed in.");

    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if ((callerProfile as { role: string } | null)?.role !== "admin") {
      throw new UserError("Only admins can change the site colors.");
    }

    const colors: Record<ThemeColorKey, string> = { ...DEFAULT_THEME_COLORS };
    for (const key of Object.keys(DEFAULT_THEME_COLORS) as ThemeColorKey[]) {
      const raw = formData.get(`color:${key}`);
      if (isHexColor(raw)) colors[key] = raw;
    }

    const { error } = await supabase
      .from("club_settings")
      .upsert({ key: "theme_colors", value: JSON.stringify(colors) }, { onConflict: "club_id,key" });

    if (error) throw new Error(error.message);

    revalidatePath("/", "layout");
  });
}

export async function updateAlertSettings(formData: FormData) {
  return tryAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UserError("Not signed in.");

    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if ((callerProfile as { role: string } | null)?.role !== "admin") {
      throw new UserError("Only admins can change alerts.");
    }

    const enabled = Object.fromEntries(
      ALERT_TYPES.map((t) => [t.kind, formData.get(`alert:${t.kind}`) !== "off"])
    );

    const { error } = await supabase
      .from("club_settings")
      .upsert({ key: ALERT_SETTINGS_KEY, value: JSON.stringify(enabled) }, { onConflict: "club_id,key" });

    if (error) throw new Error(error.message);

    revalidatePath("/");
    revalidatePath("/admin");
  });
}

// Which home-screen buttons each type of user sees.
export async function updateNavAccess(access: Record<NavRole, string[]>) {
  return tryAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UserError("Not signed in.");

    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if ((callerProfile as { role: string } | null)?.role !== "admin") {
      throw new UserError("Only admins can change which buttons are shown.");
    }

    const clean: Record<string, string[]> = { [NAV_KNOWN_KEY]: NAV_SECTIONS.map((s) => s.href) };
    for (const { role } of NAV_ROLES) {
      const allowed = new Set(navSectionsFor(role).map((s) => s.href));
      const list = Array.isArray(access?.[role]) ? access[role] : [];
      clean[role] = [...new Set(list.filter((href) => typeof href === "string" && allowed.has(href)))];
    }

    const { error } = await supabase
      .from("club_settings")
      .upsert({ key: NAV_ACCESS_KEY, value: JSON.stringify(clean) }, { onConflict: "club_id,key" });
    if (error) throw new Error(error.message);

    revalidatePath("/");
    revalidatePath("/admin");
  });
}

// Which shortcut buttons each group sees on their own profile.
export async function updateProfileButtons(access: Record<ProfileGroup, string[]>) {
  return tryAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UserError("Not signed in.");

    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if ((callerProfile as { role: string } | null)?.role !== "admin") {
      throw new UserError("Only admins can change which profile buttons are shown.");
    }

    const clean: Record<string, string[]> = { [PROFILE_KNOWN_KEY]: PROFILE_BUTTONS.map((b) => b.href) };
    for (const { group } of PROFILE_GROUPS) {
      const allowed = new Set(profileButtonsFor(group).map((b) => b.href));
      const list = Array.isArray(access?.[group]) ? access[group] : [];
      clean[group] = [...new Set(list.filter((href) => typeof href === "string" && allowed.has(href)))];
    }

    const { error } = await supabase
      .from("club_settings")
      .upsert({ key: PROFILE_BUTTONS_KEY, value: JSON.stringify(clean) }, { onConflict: "club_id,key" });
    if (error) throw new Error(error.message);

    revalidatePath("/roster", "layout");
    revalidatePath("/admin");
  });
}

// The club's oar tape colors and the most rings on an oar, for oar sheets.
export async function updateOarSettings(formData: FormData) {
  return tryAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UserError("Not signed in.");

    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if ((callerProfile as { role: string } | null)?.role !== "admin") {
      throw new UserError("Only admins can change oar colors.");
    }

    const colors = [
      ...new Set(
        String(formData.get("colors") ?? "")
          .split(",")
          .map((c) => c.trim())
          .filter((c) => c.length > 0 && c.length <= 30)
          .map((c) => c[0].toUpperCase() + c.slice(1))
      ),
    ].slice(0, 20);
    if (colors.length === 0) throw new UserError("Enter at least one tape color.");
    const maxRings = Math.trunc(Number(formData.get("max_rings")));
    if (!Number.isFinite(maxRings) || maxRings < 1 || maxRings > 20) throw new UserError("Rings must be 1 to 20.");

    const { error } = await supabase
      .from("club_settings")
      .upsert({ key: OAR_COLORS_KEY, value: JSON.stringify({ colors, maxRings }) }, { onConflict: "club_id,key" });
    if (error) throw new Error(error.message);

    revalidatePath("/admin");
    revalidatePath("/oar-sheet", "layout");
  });
}
