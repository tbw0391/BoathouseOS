// A regatta's description can carry the full published heat sheet, one race
// per line, with a trailing ★ marking the club's own races — those lines
// show highlighted on the Schedule page (see app/schedule/EventCard.tsx).
// This pulls just the starred race names back out, star stripped, for
// turning into `races` rows on the Lineups page.
export function parseStarredLines(description: string | null): string[] {
  if (!description) return [];
  return description
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.endsWith("★"))
    .map((line) => line.slice(0, -1).trim())
    .filter((line) => line.length > 0);
}
