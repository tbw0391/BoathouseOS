// Oar sheets (0095): which set of oars each regatta boat takes. A set is named
// by its tape — a color and how many pieces of tape, "1 Green" (often the
// Men's 1V) — and saved on every rowing seat. Everything is set by the club's
// admins in /admin → Oar tape and stored in club_settings "oar_colors":
//   { colors: [{ name, hex }], maxRings, sets: [{ id, color, rings, groups, boats, note }] }
// colors: the tape colors the club uses, including its own (name + swatch).
// sets: the club's master list of oar sets, each tagged with the squads that
// use it (Men's, Women's, Masters...) and the fleet boats it usually goes
// with (boat ids; a set can go with several). When there are sets, the oar sheet
// picks from that list; with none, it falls back to any color + any count.
// Older saves had colors as plain names and no sets; those still read fine.

export const OAR_COLORS_KEY = "oar_colors";

export interface TapeColor {
  name: string;
  hex: string;
}

export interface OarSet {
  id: string;
  color: string;
  rings: number;
  groups: string[];
  boats: string[];
  note: string;
}

export interface OarSettings {
  colors: TapeColor[];
  maxRings: number;
  sets: OarSet[];
}

// Squads an oar set can be tagged with: the rowing teams (lib/teams.ts).
export const OAR_GROUPS = [
  "mens",
  "womens",
  "development",
  "masters",
  "alumni",
] as const;
export const OAR_GROUP_LABELS: Record<string, string> = {
  mens: "Men's",
  womens: "Women's",
  development: "Development",
  masters: "Masters",
  alumni: "Alumni",
};

// Swatch for a standard tape color; anything unrecognized gets gray.
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
  navy: "#1e3a8a",
  maroon: "#7f1d1d",
  teal: "#0d9488",
};

const DEFAULT_COLOR_NAMES = [
  "Blue",
  "Green",
  "Red",
  "Yellow",
  "White",
  "Black",
  "Purple",
];

export const DEFAULT_OAR_SETTINGS: OarSettings = {
  colors: DEFAULT_COLOR_NAMES.map((name) => ({
    name,
    hex: SWATCHES[name.toLowerCase()],
  })),
  maxRings: 8,
  sets: [],
};

const HEX = /^#[0-9a-f]{6}$/i;

function cleanName(raw: unknown, max = 30): string {
  if (typeof raw !== "string") return "";
  const t = raw.trim().replace(/\s+/g, " ").slice(0, max);
  return t ? t[0].toUpperCase() + t.slice(1) : "";
}

// Read and tidy saved (or submitted) settings: drops blank or repeated colors,
// sets whose color isn't on the list, bad counts and unknown groups, and
// repeated sets. Never throws.
export function normalizeOarSettings(saved: unknown): OarSettings {
  const obj = (saved && typeof saved === "object" ? saved : {}) as {
    colors?: unknown;
    maxRings?: unknown;
    sets?: unknown;
  };

  const colors: TapeColor[] = [];
  const seenColor = new Set<string>();
  for (const c of Array.isArray(obj.colors) ? obj.colors : []) {
    const name = cleanName(
      typeof c === "string" ? c : (c as { name?: unknown } | null)?.name,
    );
    if (!name || seenColor.has(name.toLowerCase())) continue;
    const rawHex =
      typeof c === "object" && c ? (c as { hex?: unknown }).hex : undefined;
    const hex =
      typeof rawHex === "string" && HEX.test(rawHex)
        ? rawHex.toLowerCase()
        : (SWATCHES[name.toLowerCase()] ?? "#9ca3af");
    seenColor.add(name.toLowerCase());
    colors.push({ name, hex });
    if (colors.length >= 40) break;
  }

  const maxRingsNum = Number(obj.maxRings);
  const maxRings =
    Number.isInteger(maxRingsNum) && maxRingsNum >= 1 && maxRingsNum <= 20
      ? maxRingsNum
      : DEFAULT_OAR_SETTINGS.maxRings;

  const finalColors = colors.length ? colors : DEFAULT_OAR_SETTINGS.colors;
  const colorByLower = new Map(
    finalColors.map((c) => [c.name.toLowerCase(), c.name]),
  );

  const sets: OarSet[] = [];
  const seenSet = new Set<string>();
  for (const raw of Array.isArray(obj.sets) ? obj.sets : []) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as {
      id?: unknown;
      color?: unknown;
      rings?: unknown;
      groups?: unknown;
      boats?: unknown;
      note?: unknown;
    };
    const color = colorByLower.get(cleanName(r.color).toLowerCase());
    const rings = Number(r.rings);
    if (!color || !Number.isInteger(rings) || rings < 1 || rings > 20) continue;
    const key = `${rings} ${color}`.toLowerCase();
    if (seenSet.has(key)) continue;
    seenSet.add(key);
    const groups = Array.isArray(r.groups)
      ? [
          ...new Set(
            r.groups.filter(
              (g): g is string =>
                typeof g === "string" && g in OAR_GROUP_LABELS,
            ),
          ),
        ]
      : [];
    const boats = Array.isArray(r.boats)
      ? [
          ...new Set(
            r.boats.filter(
              (b): b is string =>
                typeof b === "string" && /^[\w-]{1,64}$/.test(b),
            ),
          ),
        ].slice(0, 50)
      : [];
    const id =
      typeof r.id === "string" && /^[\w-]{1,40}$/.test(r.id)
        ? r.id
        : key.replace(/\s+/g, "-");
    const note = typeof r.note === "string" ? r.note.trim().slice(0, 60) : "";
    sets.push({ id, color, rings, groups, boats, note });
    if (sets.length >= 100) break;
  }
  sets.sort((a, b) => a.color.localeCompare(b.color) || a.rings - b.rings);

  // A set can use more tape than the "most pieces" setting allows; raise it.
  const biggest = sets.reduce((m, s) => Math.max(m, s.rings), 0);
  return { colors: finalColors, maxRings: Math.max(maxRings, biggest), sets };
}

export function parseOarSettings(raw: string | null | undefined): OarSettings {
  try {
    return normalizeOarSettings(JSON.parse(raw ?? "null"));
  } catch {
    return DEFAULT_OAR_SETTINGS;
  }
}

// Standard colors an admin can add in one tap (they can also make their own).
export const TAPE_COLOR_CHOICES = [
  "Blue",
  "Green",
  "Red",
  "Yellow",
  "White",
  "Black",
  "Purple",
  "Orange",
  "Pink",
  "Gray",
  "Brown",
  "Silver",
  "Gold",
  "Navy",
  "Maroon",
  "Teal",
];

// Swatch for a tape color: the club's own hex when it has one, else the
// standard color, else gray.
export function tapeSwatch(
  color: string,
  colors?: readonly TapeColor[],
): string {
  const key = color.trim().toLowerCase();
  const own = colors?.find((c) => c.name.toLowerCase() === key);
  return own?.hex ?? SWATCHES[key] ?? "#9ca3af";
}

// Is this color + count allowed? With a master list, only its sets; without
// one, any club color up to the most pieces of tape.
export function oarAllowed(
  settings: OarSettings,
  color: string,
  rings: number,
): boolean {
  if (settings.sets.length > 0)
    return settings.sets.some((s) => s.color === color && s.rings === rings);
  return (
    settings.colors.some((c) => c.name === color) &&
    Number.isInteger(rings) &&
    rings >= 1 &&
    rings <= settings.maxRings
  );
}

// Sets to show for the picked squads (any of them). No squads picked = all.
// A set with no squads tagged shows for everyone, and a set that goes with
// this boat always shows. This boat's sets come first.
export function oarSetsFor(
  sets: readonly OarSet[],
  groups: readonly string[],
  boatId?: string | null,
): OarSet[] {
  const forBoat = (s: OarSet) => !!boatId && s.boats.includes(boatId);
  const shown =
    groups.length === 0
      ? [...sets]
      : sets.filter(
          (s) =>
            forBoat(s) ||
            s.groups.length === 0 ||
            s.groups.some((g) => groups.includes(g)),
        );
  return shown.sort((a, b) => Number(forBoat(b)) - Number(forBoat(a)));
}

// The boat's set: the color and count every saved seat shares, or null when
// nothing is saved or seats disagree.
export function boatOarSet<O extends { tape_color: string; rings: number }>(
  oars: O[],
): O | null {
  const first = oars[0];
  if (!first) return null;
  return oars.every(
    (o) => o.tape_color === first.tape_color && o.rings === first.rings,
  )
    ? first
    : null;
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
  return seats
    .filter((s) => s.seat_role === "rower")
    .sort((a, b) => a.seat_number - b.seat_number);
}

// Done when every rowing seat has an oar and Launch and Recovery each have
// someone.
export function oarSheetComplete(
  seats: Seat[],
  oars: { seat_number: number }[],
  tasks: { assigned: number }[],
): boolean {
  const filled = new Set(oars.map((o) => o.seat_number));
  return (
    oarSeats(seats).every((s) => filled.has(s.seat_number)) &&
    tasks.every((t) => t.assigned > 0)
  );
}
