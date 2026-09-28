export type LatLng = { lat: number; lng: number };

// Straight-line distance, which is shorter than the river on a bendy course.
export function courseDistanceLabel(a: LatLng, b: LatLng): string {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  const m = 2 * R * Math.asin(Math.sqrt(h));
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

// Accepts decimal degrees as copied from Google Maps ("40.4468, -80.0123"),
// with N/S/E/W ("40.4468 N 80.0123 W"), or degrees-minutes-seconds
// ("40°26'48.5\"N 80°0'44.3\"W", also degrees and decimal minutes).
const PART =
  /(-?\d+(?:\.\d+)?)\s*°?\s*(?:(\d+(?:\.\d+)?)\s*['′’]\s*)?(?:(\d+(?:\.\d+)?)\s*(?:["″”]|''|′′)\s*)?([NSEW])?/gi;

export function parseCoordinates(text: string): LatLng | null {
  const cleaned = text.trim().replace(/\s+/g, " ");
  const parts = [...cleaned.matchAll(PART)].filter((m) => m[0].trim() !== "");
  if (parts.length !== 2) return null;
  // Nothing but separators allowed between and around the two parts.
  const leftover = parts.reduce((rest, m) => rest.replace(m[0], ""), cleaned);
  if (!/^[\s,;]*$/.test(leftover)) return null;

  const values = parts.map((m) => {
    const deg = Number(m[1]);
    const value = Math.abs(deg) + Number(m[2] ?? 0) / 60 + Number(m[3] ?? 0) / 3600;
    const hemi = m[4]?.toUpperCase();
    const negative = deg < 0 || m[1].startsWith("-") || hemi === "S" || hemi === "W";
    return { value: negative ? -value : value, hemi };
  });
  // Longitude written first ("80.0123 W, 40.4468 N") gets swapped round.
  if (values[0].hemi === "E" || values[0].hemi === "W" || values[1].hemi === "N" || values[1].hemi === "S") {
    values.reverse();
  }
  const [lat, lng] = [values[0].value, values[1].value];
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}
