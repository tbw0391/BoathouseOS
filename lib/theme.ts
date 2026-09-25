export const DEFAULT_THEME_COLORS = {
  primary: "#022e5d",
  secondary: "#404040",
  accent: "#01213f",
  background: "#ffffff",
};

export type ThemeColorKey = keyof typeof DEFAULT_THEME_COLORS;

export type ThemeColors = Record<ThemeColorKey, string>;

export const THEME_COLOR_LABELS: Record<ThemeColorKey, string> = {
  primary: "Primary",
  secondary: "Secondary",
  accent: "Accent",
  background: "Background",
};

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_COLOR.test(value);
}

export async function getThemeColors(): Promise<ThemeColors> {
  // A demo visitor who picked their club on /choose-club sees its colors.
  // Kept in a cookie, not club_settings, since every visitor shares the one
  // demo account.
  const { cookies } = await import("next/headers");
  const { DEMO_CLUB_COOKIE, findDemoClub } = await import("@/lib/demoClubs");
  const demoClub = findDemoClub((await cookies()).get(DEMO_CLUB_COOKIE)?.value);
  if (demoClub?.colors) return { ...DEFAULT_THEME_COLORS, ...demoClub.colors };

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data } = await supabase
    .from("club_settings")
    .select("value")
    .eq("key", "theme_colors")
    .limit(1);
  const row = (data as { value: string | null }[] | null)?.[0];
  return parseThemeColors(row?.value ?? null);
}

export function parseThemeColors(raw: string | null | undefined): ThemeColors {
  if (!raw) return { ...DEFAULT_THEME_COLORS };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_THEME_COLORS };
  }

  const obj = (parsed && typeof parsed === "object" ? parsed : {}) as Record<string, unknown>;
  const result = { ...DEFAULT_THEME_COLORS };
  for (const key of Object.keys(DEFAULT_THEME_COLORS) as ThemeColorKey[]) {
    if (isHexColor(obj[key])) result[key] = obj[key] as string;
  }
  return result;
}
