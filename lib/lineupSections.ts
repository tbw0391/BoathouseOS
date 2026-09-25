import type { NavVisibility } from "@/lib/navSections";

export interface LineupSectionDef {
  id: string;
  label: string;
}

// Each independently hideable section of the Lineups page: the four team
// groups lineups/boats are organized by (id matches the Team value used
// elsewhere, e.g. lib/lineupCategories.ts's LINEUP_CATEGORY_TEAM), plus the
// two admin/coach-only management panels at the top of the page.
export const LINEUP_SECTIONS: LineupSectionDef[] = [
  { id: "mens", label: "M" },
  { id: "womens", label: "W" },
  { id: "masters", label: "Masters" },
  { id: "development", label: "Development" },
  { id: "fleet", label: "Fleet (Boats)" },
  { id: "templates", label: "Lineup Templates" },
];

export function resolveLineupSectionVisibility(
  settingsByKey: Map<string, string | null>
): Record<string, NavVisibility> {
  try {
    return JSON.parse(settingsByKey.get("lineup_section_visibility") ?? "{}");
  } catch {
    return {};
  }
}
