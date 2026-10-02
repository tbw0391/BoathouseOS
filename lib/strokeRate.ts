// Stroke rate from a coach tapping at each catch (Coach > Rate & Split).

// A pause longer than this starts a fresh count (the crew stopped, or the
// coach looked away): 4 s is under 15 strokes a minute.
export const TAP_GAP_RESET_MS = 4000;
// How many strokes the rate is averaged over.
export const RATE_STROKES = 4;

// Strokes per minute from tap times (ms, oldest first), averaged over the
// last few strokes since the most recent pause. Needs at least two strokes.
export function rateFromTaps(taps: number[], strokes = RATE_STROKES): number | null {
  let start = taps.length - 1;
  while (start > 0 && taps[start] - taps[start - 1] <= TAP_GAP_RESET_MS) start--;
  const run = taps.slice(Math.max(start, taps.length - 1 - strokes));
  if (run.length < 3) return null;
  const avgMs = (run[run.length - 1] - run[0]) / (run.length - 1);
  return avgMs > 0 ? 60000 / avgMs : null;
}

// Meters the boat travels each stroke.
export function metersPerStroke(speedMps: number, rateSpm: number): number | null {
  return rateSpm > 0 && speedMps > 0 ? (speedMps * 60) / rateSpm : null;
}

type Fix = { lat: number; lng: number; at: number; speedMps: number | null; accuracyM: number | null };

const toRad = (deg: number) => (deg * Math.PI) / 180;
function meters(a: Fix, b: Fix) {
  const h =
    Math.sin(toRad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(toRad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

// The launch's speed over the last windowMs: the phone's own speed readings
// averaged when it gives them, else distance covered between the first and
// last good fix. Blurry fixes (over 25 m) are skipped.
export function speedFromFixes(fixes: Fix[], now: number, windowMs = 10000): number | null {
  const recent = fixes.filter((f) => now - f.at <= windowMs && (f.accuracyM == null || f.accuracyM <= 25));
  if (recent.length === 0) return null;
  const reported = recent.map((f) => f.speedMps).filter((s): s is number => s != null && s >= 0);
  if (reported.length > 0) return reported.reduce((a, b) => a + b, 0) / reported.length;
  if (recent.length < 2) return null;
  const first = recent[0];
  const last = recent[recent.length - 1];
  const sec = (last.at - first.at) / 1000;
  return sec >= 2 ? meters(first, last) / sec : null;
}
