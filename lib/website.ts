import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteClubSlug } from "@/lib/clubs";
import { parseThemeColors, type ThemeColors } from "@/lib/theme";

// The public club website (/site, 0112). Visitors aren't signed in, so it
// reads with the service role, always scoped to the club whose address this
// is, and only ever selects public-safe fields: regattas (not practices),
// boat-level results (no rower names), coaches' names/titles/photos, and
// pages admins publish. Never members' contact details or minors' info.

export const WEBSITE_KEY = "website";

export const WEBSITE_SECTIONS = [
  { key: "schedule", label: "Schedule", detail: "Upcoming regattas (never practices)." },
  { key: "results", label: "Results", detail: "Recent places and medals by boat, no rower names." },
  { key: "coaches", label: "Coaches & board", detail: "Names, titles and photos only." },
  { key: "news", label: "News", detail: "Posts you publish here." },
  { key: "contact", label: "Contact", detail: "A form that emails the club's admins." },
  { key: "join", label: "Join", detail: "A form for people who want to row or join." },
] as const;
export type WebsiteSection = (typeof WEBSITE_SECTIONS)[number]["key"];

export type WebsiteSettings = {
  enabled: boolean;
  tagline: string;
  about: string;
  joinText: string;
  sections: Record<WebsiteSection, boolean>;
  heroPath: string | null;
};

export function parseWebsiteSettings(raw: string | null | undefined): WebsiteSettings {
  const settings: WebsiteSettings = {
    enabled: false,
    tagline: "",
    about: "",
    joinText: "",
    sections: Object.fromEntries(WEBSITE_SECTIONS.map((s) => [s.key, true])) as Record<WebsiteSection, boolean>,
    heroPath: null,
  };
  if (!raw) return settings;
  try {
    const saved = JSON.parse(raw) as Partial<WebsiteSettings>;
    if (typeof saved.enabled === "boolean") settings.enabled = saved.enabled;
    if (typeof saved.tagline === "string") settings.tagline = saved.tagline;
    if (typeof saved.about === "string") settings.about = saved.about;
    if (typeof saved.joinText === "string") settings.joinText = saved.joinText;
    if (typeof saved.heroPath === "string") settings.heroPath = saved.heroPath;
    for (const s of WEBSITE_SECTIONS) {
      const v = saved.sections?.[s.key];
      if (typeof v === "boolean") settings.sections[s.key] = v;
    }
  } catch {
    // Unreadable: the defaults.
  }
  return settings;
}

export type SiteClub = {
  id: string;
  name: string;
  appName: string;
  settings: WebsiteSettings;
  colors: ThemeColors;
  iconUrl: string | null;
  heroUrl: string | null;
  storeUrl: string | null;
  pages: { slug: string; title: string; menu_group: string | null }[];
};

// The club this address is for, with its website settings; null if there's
// no such club. Cached per request.
export const getSiteClub = cache(async (): Promise<SiteClub | null> => {
  const admin = createAdminClient();
  const { data: clubRow } = await admin
    .from("clubs")
    .select("id, name, app_name, icon_path, icon_updated_at, suspended_at")
    .eq("slug", await siteClubSlug())
    .maybeSingle();
  const club = clubRow as {
    id: string;
    name: string;
    app_name: string | null;
    icon_path: string | null;
    icon_updated_at: string | null;
    suspended_at: string | null;
  } | null;
  if (!club || club.suspended_at) return null;

  const [{ data: settingRows }, { data: pageRows }] = await Promise.all([
    admin.from("club_settings").select("key, value").eq("club_id", club.id).in("key", [WEBSITE_KEY, "theme_colors", "team_store_url"]),
    admin
      .from("website_pages")
      .select("slug, title, menu_group")
      .eq("club_id", club.id)
      .eq("kind", "page")
      .eq("published", true)
      .order("sort_order")
      .order("title"),
  ]);
  const byKey = new Map(((settingRows as { key: string; value: string | null }[] | null) ?? []).map((r) => [r.key, r.value]));
  const settings = parseWebsiteSettings(byKey.get(WEBSITE_KEY));

  let heroUrl: string | null = null;
  if (settings.heroPath) {
    const { data } = await admin.storage.from("club-icons").createSignedUrl(settings.heroPath, 60 * 60);
    heroUrl = data?.signedUrl ?? null;
  }

  return {
    id: club.id,
    name: club.name,
    appName: club.app_name?.trim() || club.name,
    settings,
    colors: parseThemeColors(byKey.get("theme_colors") ?? null),
    iconUrl: club.icon_path ? `/club-icon/512?v=${club.icon_updated_at ? Date.parse(club.icon_updated_at) : "1"}` : null,
    heroUrl,
    storeUrl: byKey.get("team_store_url") || null,
    pages: (pageRows as { slug: string; title: string; menu_group: string | null }[] | null) ?? [],
  };
});

// Titles imported from other sites can carry HTML entities ("&mdash;").
export function decodeEntities(text: string): string {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", mdash: "—", ndash: "–", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…" };
  return text.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return named[code.toLowerCase()] ?? m;
  });
}

export async function upcomingRegattas(clubId: string, limit = 20) {
  const { data } = await createAdminClient()
    .from("schedule_events")
    .select("id, title, location, starts_at, ends_at")
    .eq("club_id", clubId)
    .eq("event_type", "regatta")
    .gte("starts_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order("starts_at")
    .limit(limit);
  return ((data as { id: string; title: string; location: string | null; starts_at: string; ends_at: string | null }[] | null) ?? []).map(
    (r) => ({ ...r, title: decodeEntities(r.title), location: r.location ? decodeEntities(r.location) : null })
  );
}

// Places by boat at recent regattas; never who rowed.
export async function recentResults(clubId: string, regattas = 6) {
  const admin = createAdminClient();
  const { data: eventRows } = await admin
    .from("schedule_events")
    .select("id, title, starts_at")
    .eq("club_id", clubId)
    .eq("event_type", "regatta")
    .lt("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: false })
    .limit(regattas * 3);
  const events = (eventRows as { id: string; title: string; starts_at: string }[] | null) ?? [];
  if (events.length === 0) return [];
  const { data: lineupRows } = await admin
    .from("lineups")
    .select("event_id, race_name, boat_class, category, place")
    .eq("club_id", clubId)
    .in("event_id", events.map((e) => e.id))
    .not("place", "is", null);
  const lineups =
    (lineupRows as { event_id: string; race_name: string | null; boat_class: string | null; category: string | null; place: number }[] | null) ?? [];
  return events
    .map((e) => ({
      ...e,
      title: decodeEntities(e.title),
      races: lineups
        .filter((l) => l.event_id === e.id)
        .sort((a, b) => a.place - b.place)
        .map((l) => ({ race: l.race_name || [l.category, l.boat_class].filter(Boolean).join(" ") || "Race", place: l.place })),
    }))
    .filter((e) => e.races.length > 0)
    .slice(0, regattas);
}

// Coaches and the board: name, title and photo only.
export async function publicPeople(clubId: string) {
  const { data } = await createAdminClient()
    .from("profiles")
    .select("id, display_name, club_title, photo_url, role, is_board_member")
    .eq("club_id", clubId)
    .not("approved_at", "is", null)
    .is("disabled_at", null)
    .or("role.eq.coach,is_board_member.eq.true")
    .order("display_name");
  const people =
    (data as { id: string; display_name: string; club_title: string | null; photo_url: string | null; role: string; is_board_member: boolean }[] | null) ?? [];
  return {
    coaches: people.filter((p) => p.role === "coach"),
    board: people.filter((p) => p.is_board_member),
  };
}

export async function publishedPage(clubId: string, slug: string) {
  const { data } = await createAdminClient()
    .from("website_pages")
    .select("title, body, kind, created_at, updated_at")
    .eq("club_id", clubId)
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  return data as { title: string; body: string; kind: string; created_at: string; updated_at: string } | null;
}

export async function newsPosts(clubId: string, limit = 10) {
  const { data } = await createAdminClient()
    .from("website_pages")
    .select("slug, title, body, created_at")
    .eq("club_id", clubId)
    .eq("kind", "news")
    .eq("published", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as { slug: string; title: string; body: string; created_at: string }[] | null) ?? [];
}

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "page"
  );
}
