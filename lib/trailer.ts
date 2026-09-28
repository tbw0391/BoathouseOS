// Trailer loading list (Trailer tab on a regatta's page).

export type TrailerKind = "boat" | "oars" | "rigging" | "electronics" | "other";

export const TRAILER_KIND_LABELS: Record<TrailerKind, string> = {
  boat: "Boats",
  oars: "Oars",
  rigging: "Riggers and rigging",
  electronics: "Cox boxes and electronics",
  other: "Everything else",
};
export const TRAILER_KIND_ORDER: TrailerKind[] = ["boat", "oars", "rigging", "electronics", "other"];

// Tap-to-add gear most trips need.
export const TRAILER_PRESETS: { label: string; kind: TrailerKind }[] = [
  { label: "Riggers", kind: "rigging" },
  { label: "Rigging tool kit", kind: "rigging" },
  { label: "Spare parts bin", kind: "rigging" },
  { label: "Cox boxes", kind: "electronics" },
  { label: "Speakers and wiring", kind: "electronics" },
  { label: "Chargers", kind: "electronics" },
  { label: "Slings", kind: "other" },
  { label: "Ratchet straps", kind: "other" },
  { label: "Bow balls and bow numbers", kind: "other" },
  { label: "Launch and motor", kind: "other" },
  { label: "Launch gas can", kind: "other" },
  { label: "Life jackets", kind: "other" },
  { label: "First aid kit", kind: "other" },
  { label: "Team tent", kind: "other" },
];

export type TrailerLeg = "out" | "home";

export function packedCount(items: { packed_out_at: string | null; packed_home_at: string | null }[], leg: TrailerLeg) {
  return items.filter((i) => (leg === "out" ? i.packed_out_at : i.packed_home_at) != null).length;
}
