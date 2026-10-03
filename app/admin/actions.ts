"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
import { saveClubAppBranding } from "@/lib/clubIcon";
import { PAPERWORK, PAPERWORK_ROLES, PAPERWORK_SETTINGS_KEY } from "@/lib/paperwork";
import { CHECK_IN_GROUPS, CHECK_IN_SETTINGS_KEY } from "@/lib/checkIns";
import { DEFAULT_THEME_COLORS, isHexColor, type ThemeColorKey } from "@/lib/theme";
import { ALERT_SETTINGS_KEY, ALERT_TYPES } from "@/lib/alertSettings";
import { OAR_COLORS_KEY, normalizeOarSettings } from "@/lib/oarSheet";
import {
  PROFILE_BUTTONS,
  PROFILE_BUTTONS_KEY,
  PROFILE_GROUPS,
  PROFILE_KNOWN_KEY,
  profileButtonsFor,
  type ProfileGroup,
} from "@/lib/profileButtons";
import { UserError, tryAction } from "@/lib/userError";
import { RECRUITING_KEY } from "@/lib/recruiting";

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

// College recruiting (0121): whether the club's rowers and coxswains can
// list themselves for college coaches.
export async function updateRecruiting(formData: FormData) {
  return tryAction(async () => {
    const supabase = await createClient();
    const { data: isAdmin } = await supabase.rpc("is_club_admin");
    if (!isAdmin) throw new UserError("Only admins can change this.");
    const { error } = await supabase
      .from("club_settings")
      .upsert({ key: RECRUITING_KEY, value: formData.get("recruiting") === "on" ? "on" : "off" }, { onConflict: "club_id,key" });
    if (error) throw new Error(error.message);
    revalidatePath("/admin");
    revalidatePath("/roster", "layout");
  });
}

// Who gets the coach check-in button (lib/checkIns.ts).
export async function updateCheckInSettings(formData: FormData) {
  return tryAction(async () => {
    const supabase = await createClient();
    const { data: isAdmin } = await supabase.rpc("is_club_admin");
    if (!isAdmin) throw new UserError("Only admins can change who checks in.");

    const known: readonly string[] = CHECK_IN_GROUPS.map((g) => g.group);
    const groups = formData.getAll("check_in_group").map(String).filter((g) => known.includes(g));
    const { error } = await supabase
      .from("club_settings")
      .upsert({ key: CHECK_IN_SETTINGS_KEY, value: JSON.stringify({ groups }) }, { onConflict: "club_id,key" });
    if (error) throw new Error(error.message);

    revalidatePath("/");
    revalidatePath("/admin");
    revalidatePath("/roster", "layout");
  });
}

// Which roles need each piece of paperwork, and whether parents see their
// child's paperwork (lib/paperwork.ts).
export async function updatePaperworkSettings(formData: FormData) {
  return tryAction(async () => {
    const supabase = await createClient();
    const { data: isAdmin } = await supabase.rpc("is_club_admin");
    if (!isAdmin) throw new UserError("Only admins can change paperwork settings.");

    const roles: readonly string[] = PAPERWORK_ROLES.map((r) => r.role);
    const required = Object.fromEntries(
      PAPERWORK.map((p) => [
        p.kind,
        formData.getAll(`paperwork:${p.kind}`).map(String).filter((r) => roles.includes(r)),
      ])
    );
    const value = JSON.stringify({ required, parentsSeeChild: formData.get("parents_see_child") === "on" });

    const { error } = await supabase
      .from("club_settings")
      .upsert({ key: PAPERWORK_SETTINGS_KEY, value }, { onConflict: "club_id,key" });
    if (error) throw new Error(error.message);

    revalidatePath("/admin");
    revalidatePath("/coach/paperwork");
    revalidatePath("/roster", "layout");
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

// The club's oar tape colors, most pieces of tape, and master list of oar
// sets (with the squads that use each), for oar sheets.
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

    let submitted: unknown;
    try {
      submitted = JSON.parse(String(formData.get("oar_settings") ?? ""));
    } catch {
      throw new UserError("Couldn't read the oar settings. Reload the page and try again.");
    }
    const raw = (submitted ?? {}) as { colors?: unknown[] };
    if (!Array.isArray(raw.colors) || raw.colors.length === 0) throw new UserError("Add at least one tape color.");
    const settings = normalizeOarSettings(submitted);
    const { error } = await supabase
      .from("club_settings")
      .upsert({ key: OAR_COLORS_KEY, value: JSON.stringify(settings) }, { onConflict: "club_id,key" });
    if (error) throw new Error(error.message);

    revalidatePath("/admin");
    revalidatePath("/oar-sheet", "layout");
    revalidatePath("/lineups", "layout");
    revalidatePath("/race-day");
  });
}

// The app's name and home-screen icon for this club (0106). Written with the
// service role after checking the caller is this club's admin; clubs have
// no update policy.
export async function updateAppIcon(formData: FormData) {
  return tryAction(async () => {
    const supabase = await createClient();
    const { data: isAdmin } = await supabase.rpc("is_club_admin");
    if (!isAdmin) throw new UserError("Only admins can change the app's name and icon.");
    const { data: clubId } = await supabase.rpc("current_club_id");
    if (!clubId) throw new UserError("Couldn't tell which club you're in.");
    await saveClubAppBranding(clubId as string, formData);
    revalidatePath("/", "layout");
  });
}

export async function removeAppIcon() {
  return tryAction(async () => {
    const supabase = await createClient();
    const { data: isAdmin } = await supabase.rpc("is_club_admin");
    if (!isAdmin) throw new UserError("Only admins can change the app's icon.");
    const { data: clubId } = await supabase.rpc("current_club_id");
    if (!clubId) throw new UserError("Couldn't tell which club you're in.");
    const { error } = await createAdminClient()
      .from("clubs")
      .update({ icon_path: null, icon_updated_at: new Date().toISOString() })
      .eq("id", clubId as string);
    if (error) throw new Error(error.message);
    revalidatePath("/", "layout");
  });
}
