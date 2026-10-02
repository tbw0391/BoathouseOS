// Pure helpers for automatic lightning warnings (lib/lightning.ts).

export type Flash = { lat: number; lon: number; at: number };

// A GLM file's start time from its name, e.g.
// "OR_GLM-L2-LCFA_G19_s20262750200000_e..." = 2026, day 275, 02:00:00.0 UTC.
export function glmFileStart(key: string): number | null {
  const m = key.match(/_s(\d{4})(\d{3})(\d{2})(\d{2})(\d{2})(\d)_/);
  if (!m) return null;
  const [year, doy, h, min, sec, tenth] = m.slice(1).map(Number);
  return Date.UTC(year, 0, doy, h, min, sec, tenth * 100);
}

const toRad = (d: number) => (d * Math.PI) / 180;

export function milesBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const h =
    Math.sin(toRad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(toRad(b.lon - a.lon) / 2) ** 2;
  return 2 * 3958.8 * Math.asin(Math.sqrt(h));
}

function bearingDeg(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const y = Math.sin(toRad(b.lon - a.lon)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lon - a.lon));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// The latest flash within `miles` of the point (the nearest, if several at
// once), with how far and which way it was.
export function flashesNearPoint(
  flashes: Flash[],
  point: { lat: number; lon: number },
  miles: number
): { at: number; miles: number; bearingDeg: number } | null {
  let best: { at: number; miles: number; bearingDeg: number } | null = null;
  for (const f of flashes) {
    const d = milesBetween(point, f);
    if (d > miles) continue;
    if (!best || f.at > best.at || (f.at === best.at && d < best.miles)) {
      best = { at: f.at, miles: d, bearingDeg: bearingDeg(point, f) };
    }
  }
  return best;
}
