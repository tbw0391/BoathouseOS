// Oar sheets (0095): for each regatta boat, which oar goes in each seat.
// Oars are named by their tape — a color and a number of rings, "3 Green" —
// and the club's tape colors and most rings are set in /admin, stored in
// club_settings "oar_colors" as { colors: string[], maxRings: number }.

export const OAR_COLORS_KEY = "oar_colors";

export interface OarSettings {
  colors: string[];
  maxRings: number;
}

export const DEFAULT_OAR_SETTINGS: OarSettings = {
  colors: ["Blue", "Green", "Red", "Yellow", "White", "Black"],
  maxRings: 8,
};

export function parseOarSettings(raw: string | null | undefined): OarSettings {
  try {
    const saved = JSON.parse(raw ?? "null") as Partial<OarSettings> | null;
    const colors = Array.isArray(saved?.colors)
      ? saved.colors.filter((c): c is string => typeof c === "string" && c.trim() !== "").map((c) => c.trim())
      : [];
    const maxRings = Number(saved?.maxRings);
    return {
      colors: colors.length ? colors : DEFAULT_OAR_SETTINGS.colors,
      maxRings: Number.isInteger(maxRings) && maxRings >= 1 && maxRings <= 20 ? maxRings : DEFAULT_OAR_SETTINGS.maxRings,
    };
  } catch {
    return DEFAULT_OAR_SETTINGS;
  }
}

// Swatch for a tape color's chip; anything unrecognized gets gray.
const SWATCHES: Record<string, string> = {
  blue: "#2563eb",
  green: "#16a34a",
  red: "#dc2626",
  yellow: "#facc15",
  white: "#ffffff",
  black: "#111827",
  orange: "#f97316",
  purple: "#9333ea",
  pink: "#ec4899",
  gray: "#9ca3af",
  grey: "#9ca3af",
  brown: "#92400e",
  silver: "#cbd5e1",
  gold: "#ca8a04",
};

export function tapeSwatch(color: string): string {
  return SWATCHES[color.trim().toLowerCase()] ?? "#9ca3af";
}

export function oarLabel(oar: { rings: number; tape_color: string }): string {
  return `${oar.rings} ${oar.tape_color}`;
}

type Seat = { seat_number: number; seat_role: string; rower_id: string | null };

// Who fills in the sheet: the cox, or the stroke seat (highest-numbered
// rower seat) in boats without a cox. Mirrors is_lineup_captain() in 0095.
export function captainSeat<S extends Seat>(seats: S[]): S | null {
  const cox = seats.find((s) => s.seat_role === "coxswain");
  if (cox) return cox;
  const rowers = seats.filter((s) => s.seat_role === "rower");
  if (rowers.length === 0) return null;
  return rowers.reduce((a, b) => (b.seat_number > a.seat_number ? b : a));
}

// The seats that need an oar, bow to stroke.
export function oarSeats<S extends Seat>(seats: S[]): S[] {
  return seats.filter((s) => s.seat_role === "rower").sort((a, b) => a.seat_number - b.seat_number);
}

// Done when every rowing seat has an oar and Launch and Recovery each have
// someone.
export function oarSheetComplete(
  seats: Seat[],
  oars: { seat_number: number }[],
  tasks: { assigned: number }[]
): boolean {
  const filled = new Set(oars.map((o) => o.seat_number));
  return oarSeats(seats).every((s) => filled.has(s.seat_number)) && tasks.every((t) => t.assigned > 0);
}
