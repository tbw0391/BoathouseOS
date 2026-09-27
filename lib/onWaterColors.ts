// The 10 map colors a coxswain can pick for their boat. The database only
// accepts these (supabase/migrations/0071_on_water_color_choice.sql), so keep
// the two lists in step.
export const ON_WATER_COLORS = [
  { hex: "#dc2626", name: "Red" },
  { hex: "#2563eb", name: "Blue" },
  { hex: "#16a34a", name: "Green" },
  { hex: "#ea580c", name: "Orange" },
  { hex: "#9333ea", name: "Purple" },
  { hex: "#db2777", name: "Pink" },
  { hex: "#0d9488", name: "Teal" },
  { hex: "#ca8a04", name: "Gold" },
  { hex: "#92400e", name: "Brown" },
  { hex: "#111827", name: "Black" },
] as const;

export const isOnWaterColor = (hex: string) => ON_WATER_COLORS.some((c) => c.hex === hex);
