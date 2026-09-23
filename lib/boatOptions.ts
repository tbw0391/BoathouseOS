// Hull color and rig, offered alongside boat class/type on the Add Boat form.

export const HULL_COLORS: Record<string, { label: string; swatch: string }> = {
  white: { label: "White", swatch: "#ffffff" },
  black: { label: "Black", swatch: "#000000" },
  red: { label: "Red", swatch: "#dc2626" },
  blue: { label: "Blue", swatch: "#2563eb" },
  green: { label: "Green", swatch: "#16a34a" },
  yellow: { label: "Yellow", swatch: "#eab308" },
  orange: { label: "Orange", swatch: "#ea580c" },
  silver: { label: "Silver", swatch: "#9ca3af" },
};
export const HULL_COLOR_OPTIONS = Object.keys(HULL_COLORS);

export const RIGS: Record<string, string> = {
  port: "Port",
  starboard: "Starboard",
  port_bucket: "Port Bucket",
  starboard_bucket: "Starboard Bucket",
  scull: "Scull",
};
export const RIG_OPTIONS = Object.keys(RIGS);
