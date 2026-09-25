import type { Team } from "@/lib/database.types";

// Depth categories only apply to team boats — a single/double/pair (1x, 2x,
// 2-) doesn't have a "1st/2nd/3rd/4th" concept the way a squad's 8+/4+/4x/4-
// entries do. A rower's depth is per boat class, not a fixed team-wide rank
// (e.g. someone can be in the 1V8 and the 2V4 at the same regatta).
const DEPTH_BOAT_CLASSES: { slug: string; label: string; boatClass: string }[] = [
  { slug: "8plus", label: "8", boatClass: "8+" },
  { slug: "4plus", label: "4+", boatClass: "4+" },
  { slug: "4x", label: "4x", boatClass: "4x" },
  { slug: "4minus", label: "4-", boatClass: "4-" },
];

const DEPTHS = [1, 2, 3, 4];

const GENDERS: { slug: "mens" | "womens"; label: string }[] = [
  { slug: "mens", label: "M" },
  { slug: "womens", label: "W" },
];

const LINEUP_CATEGORIES: Record<string, string> = {};
const LINEUP_CATEGORY_TEAM: Record<string, Team> = {};
const LINEUP_CATEGORY_GROUPS: { label: string; options: string[] }[] = [];

// Every depth category maps to exactly one boat class — this is also the set
// of categories a fleet boat (an 8 or a 4) can be designated as; masters,
// development, and non-depth classes (1x/2x/2-) are never a "boat category".
const CATEGORY_BOAT_CLASS: Record<string, string> = {};
const FLEET_CATEGORY_GROUPS: { label: string; options: string[] }[] = [];

for (const gender of GENDERS) {
  const groupOptions: string[] = [];
  for (const boatClass of DEPTH_BOAT_CLASSES) {
    for (const depth of DEPTHS) {
      const key = `${gender.slug}_${depth}_${boatClass.slug}`;
      LINEUP_CATEGORIES[key] = `${gender.label} ${depth}V${boatClass.label}`;
      LINEUP_CATEGORY_TEAM[key] = gender.slug;
      CATEGORY_BOAT_CLASS[key] = boatClass.boatClass;
      groupOptions.push(key);
    }
  }
  LINEUP_CATEGORY_GROUPS.push({ label: gender.label, options: groupOptions });
  FLEET_CATEGORY_GROUPS.push({ label: gender.label, options: [...groupOptions] });
}

// Masters gets a shallower depth chart than Men's/Women's: just 1st-3rd, and
// only for 8+ and 4+ (the two boat classes masters actually fields). The
// flat "masters" category is kept below alongside "development" for
// backward compatibility with existing data written before this split.
const MASTERS_DEPTHS = [1, 2, 3];
const MASTERS_BOAT_CLASSES = DEPTH_BOAT_CLASSES.filter((bc) => bc.slug === "8plus" || bc.slug === "4plus");

const mastersGroupOptions: string[] = [];
for (const boatClass of MASTERS_BOAT_CLASSES) {
  for (const depth of MASTERS_DEPTHS) {
    const key = `masters_${depth}_${boatClass.slug}`;
    LINEUP_CATEGORIES[key] = `Masters ${depth}V${boatClass.label}`;
    LINEUP_CATEGORY_TEAM[key] = "masters";
    CATEGORY_BOAT_CLASS[key] = boatClass.boatClass;
    mastersGroupOptions.push(key);
  }
}
LINEUP_CATEGORY_GROUPS.push({ label: "Masters", options: mastersGroupOptions });
FLEET_CATEGORY_GROUPS.push({ label: "Masters", options: [...mastersGroupOptions] });

LINEUP_CATEGORIES.masters = "Masters";
LINEUP_CATEGORIES.development = "Development";
LINEUP_CATEGORY_TEAM.masters = "masters";
LINEUP_CATEGORY_TEAM.development = "development";
LINEUP_CATEGORY_GROUPS.push({ label: "Other", options: ["masters", "development"] });

// Flat Novice categories, one per gender — like masters/development, this is
// never depth-numbered and never a Fleet boat's own "category".
LINEUP_CATEGORIES.mens_novice = "M Novice";
LINEUP_CATEGORIES.womens_novice = "W Novice";
LINEUP_CATEGORY_TEAM.mens_novice = "mens";
LINEUP_CATEGORY_TEAM.womens_novice = "womens";
LINEUP_CATEGORY_GROUPS.push({ label: "Novice", options: ["mens_novice", "womens_novice"] });

export { LINEUP_CATEGORIES, LINEUP_CATEGORY_TEAM, LINEUP_CATEGORY_GROUPS, CATEGORY_BOAT_CLASS, FLEET_CATEGORY_GROUPS };
export const LINEUP_CATEGORY_OPTIONS = Object.keys(LINEUP_CATEGORIES);
export const FLEET_CATEGORY_OPTIONS = Object.keys(CATEGORY_BOAT_CLASS);
