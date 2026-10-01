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

// High school, grad year, boat side, erg times and US Rowing number: for
// people who row or cox. Parents never get them, even if they're on the
// Masters team (often just for its chat); a coach or admin does only when
// they row masters.
export function hasRowingDetails(role: string, teams: readonly string[]): boolean {
  if (role === "rower" || role === "coxswain") return true;
  if (role === "parent") return false;
  return teams.includes("masters");
}
