import type { Team } from "@/lib/database.types";

export const LINEUP_CATEGORIES: Record<string, string> = {
  mens_varsity: "Men's Varsity",
  mens_novice: "Men's Novice",
  womens_varsity: "Women's Varsity",
  womens_novice: "Women's Novice",
  masters: "Masters",
  development: "Development",
};

export const LINEUP_CATEGORY_OPTIONS = Object.keys(LINEUP_CATEGORIES);

// Which roster group a category's seats can be filled from.
export const LINEUP_CATEGORY_TEAM: Record<string, Team> = {
  mens_varsity: "mens",
  mens_novice: "mens",
  womens_varsity: "womens",
  womens_novice: "womens",
  masters: "masters",
  development: "development",
};
