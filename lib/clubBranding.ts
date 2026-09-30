import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteClubSlug } from "@/lib/clubs";

// The name and icon members' phones show for the app: the club whose address
// this is (see 0106_club_app_icon.sql), or BoathouseOS's own.

export const DEFAULT_APP_NAME = "BoathouseOS";
export const ICON_SIZES = [180, 192, 512] as const;

export type ClubBranding = {
  clubId: string | null;
  appName: string;
  shortName: string;
  iconPath: string | null;
  // Changes when the icon does, so phones fetch the new one.
  iconVersion: string;
};

export async function siteClubBranding(): Promise<ClubBranding> {
  const fallback: ClubBranding = {
    clubId: null,
    appName: DEFAULT_APP_NAME,
    shortName: DEFAULT_APP_NAME,
    iconPath: null,
    iconVersion: "default",
  };
  try {
    const { data } = await createAdminClient()
      .from("clubs")
      .select("id, app_name, app_short_name, icon_path, icon_updated_at")
      .eq("slug", await siteClubSlug())
      .maybeSingle();
    const club = data as {
      id: string;
      app_name: string | null;
      app_short_name: string | null;
      icon_path: string | null;
      icon_updated_at: string | null;
    } | null;
    if (!club) return fallback;
    const appName = club.app_name?.trim() || DEFAULT_APP_NAME;
    return {
      clubId: club.id,
      appName,
      shortName: club.app_short_name?.trim() || appName,
      iconPath: club.icon_path,
      iconVersion: club.icon_path && club.icon_updated_at ? String(Date.parse(club.icon_updated_at)) : "default",
    };
  } catch {
    return fallback;
  }
}
