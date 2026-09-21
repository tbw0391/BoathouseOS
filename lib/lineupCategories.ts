import type { Team } from "@/lib/database.types";

// Depth categories only apply to team boats — a single/double/pair (1x, 2x,
// 2-) doesn't have a "1st/2nd/3rd/4th" concept the way a squad's 8+/4+/4x/4-
// entries do. A rower's depth is per boat class, not a fixed team-wide rank
// (e.g. someone can be in the 1V8 and the 2V4 at the same regatta).
const DEPTH_BOAT_CLASSES: { slug: string; label: string }[] = [
  { slug: "8plus", label: "8" },
  { slug: "4plus", label: "4+" },
  { slug: "4x", label: "4x" },
  { slug: "4minus", label: "4-" },
];

const DEPTHS = [1, 2, 3, 4];

const GENDERS: { slug: "mens" | "womens"; label: string }[] = [
  { slug: "mens", label: "Men's" },
  { slug: "womens", label: "Women's" },
];

const LINEUP_CATEGORIES: Record<string, string> = {};
const LINEUP_CATEGORY_TEAM: Record<string, Team> = {};
const LINEUP_CATEGORY_GROUPS: { label: string; options: string[] }[] = [];

for (const gender of GENDERS) {
  const groupOptions: string[] = [];
  for (const boatClass of DEPTH_BOAT_CLASSES) {
    for (const depth of DEPTHS) {
      const key = `${gender.slug}_${depth}_${boatClass.slug}`;
      LINEUP_CATEGORIES[key] = `${gender.label} ${depth}V${boatClass.label}`;
      LINEUP_CATEGORY_TEAM[key] = gender.slug;
      groupOptions.push(key);
    }
  }
  LINEUP_CATEGORY_GROUPS.push({ label: gender.label, options: groupOptions });
}

LINEUP_CATEGORIES.masters = "Masters";
LINEUP_CATEGORIES.development = "Development";
LINEUP_CATEGORY_TEAM.masters = "masters";
LINEUP_CATEGORY_TEAM.development = "development";
LINEUP_CATEGORY_GROUPS.push({ label: "Other", options: ["masters", "development"] });

export { LINEUP_CATEGORIES, LINEUP_CATEGORY_TEAM, LINEUP_CATEGORY_GROUPS };
export const LINEUP_CATEGORY_OPTIONS = Object.keys(LINEUP_CATEGORIES);
