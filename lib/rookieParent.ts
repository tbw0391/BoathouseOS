// Sections of the Rookie Parent page. Admins add, rename, reorder and remove
// them on the page itself; the list lives in club_settings as JSON under
// ROOKIE_PARENT_SECTIONS_KEY. Until the first edit, the page shows the
// starter sections below, with any text saved under their old per-section keys.
export const ROOKIE_PARENT_SECTIONS_KEY = "rookie_parent_sections";

export type RookieParentSection = { id: string; title: string; text: string | null };

export const DEFAULT_ROOKIE_PARENT_SECTIONS = [
  { id: "faq", key: "rookie_parent_faq", title: "FAQ" },
  { id: "what-to-bring", key: "rookie_parent_what_to_bring", title: "What to Bring" },
  { id: "locations", key: "rookie_parent_locations", title: "Food Tent, Parking & Team Tent" },
] as const;

export const LEGACY_ROOKIE_PARENT_KEYS = DEFAULT_ROOKIE_PARENT_SECTIONS.map((s) => s.key);

export function parseRookieParentSections(
  raw: string | null | undefined,
  legacyTextByKey: Map<string, string | null> = new Map(),
): RookieParentSection[] {
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((s) => s && typeof s.id === "string" && typeof s.title === "string")
          .map((s) => ({ id: s.id, title: s.title, text: typeof s.text === "string" ? s.text : null }));
      }
    } catch {
      // Fall through to the starter sections.
    }
  }
  return DEFAULT_ROOKIE_PARENT_SECTIONS.map((s) => ({
    id: s.id,
    title: s.title,
    text: legacyTextByKey.get(s.key) ?? null,
  }));
}
