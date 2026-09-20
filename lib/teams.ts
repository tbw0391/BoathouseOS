import type { Team } from "@/lib/database.types";

export const TEAM_LABELS: Record<Team, string> = {
  mens: "Men's",
  womens: "Women's",
  development: "Development",
  masters: "Masters",
  alumni: "Alumni",
  coach: "Coaches",
  parent: "Parent",
};

export const TEAM_OPTIONS: Team[] = [
  "mens",
  "womens",
  "development",
  "masters",
  "alumni",
  "coach",
  "parent",
];
