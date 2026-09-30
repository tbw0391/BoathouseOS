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
// people who row or cox (masters included), not parents, coaches or board
// admins.
export function hasRowingDetails(role: string, teams: readonly string[]): boolean {
  return role === "rower" || role === "coxswain" || teams.includes("masters");
}
