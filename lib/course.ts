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

// Course markers (0133): pins along the course besides the start and finish,
// named by their distance from the start ("500 m"), stored on the regatta as
// schedule_events.course_markers in course order.
export type CourseMarker = LatLng & { m: number };

export const MAX_COURSE_MARKERS = 20;

// Tidy saved or submitted markers: valid points with a whole-metre distance
// above 0 and under 20 km, one per distance, in course order.
export function parseCourseMarkers(raw: unknown): CourseMarker[] {
  if (!Array.isArray(raw)) return [];
  const byMeters = new Map<number, CourseMarker>();
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const { m, lat, lng } = r as { m?: unknown; lat?: unknown; lng?: unknown };
    const meters = Math.round(Number(m));
    const la = Number(lat);
    const ln = Number(lng);
    if (!Number.isFinite(meters) || meters <= 0 || meters >= 20000) continue;
    if (!Number.isFinite(la) || !Number.isFinite(ln) || Math.abs(la) > 90 || Math.abs(ln) > 180) continue;
    if (!byMeters.has(meters)) byMeters.set(meters, { m: meters, lat: la, lng: ln });
  }
  return [...byMeters.values()].sort((a, b) => a.m - b.m).slice(0, MAX_COURSE_MARKERS);
}

// Markers every `every` metres on a straight course of `length` metres, laid
// along the line from start to finish (500, 1000, 1500 on a 2000 m course).
// Coaches can drag them onto the real line afterwards on a bendy course.
export function markersAlongLine(start: LatLng, finish: LatLng, length: number, every: number): CourseMarker[] {
  if (!(length > 0) || !(every > 0)) return [];
  const out: CourseMarker[] = [];
  for (let m = every; m < length && out.length < MAX_COURSE_MARKERS; m += every) {
    const f = m / length;
    out.push({ m, lat: start.lat + (finish.lat - start.lat) * f, lng: start.lng + (finish.lng - start.lng) * f });
  }
  return out;
}

// How far (metres) point p is past marker m, measured along the direction
// from a (the pin before it) to b (the pin after it); negative = not there
// yet. Mirrors past_marker_m() in 0133.
export function pastMarkerM(p: LatLng, m: LatLng, a: LatLng, b: LatLng): number | null {
  const k = Math.cos((m.lat * Math.PI) / 180);
  const dx = (b.lng - a.lng) * k;
  const dy = b.lat - a.lat;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return null;
  return (111320 * ((p.lng - m.lng) * k * dx + (p.lat - m.lat) * dy)) / len;
}

// When the boat passed a marker between two pings, worked out from how far
// behind and past it each ping was. Null when the pings don't straddle it.
export function crossingTime(
  prev: { at: number; past: number },
  next: { at: number; past: number }
): number | null {
  if (!(prev.past < 0 && next.past >= 0)) return null;
  return prev.at + (next.at - prev.at) * (-prev.past / (next.past - prev.past));
}

// "1:52.3" (or "12:04.0" / "1:02:15.0") from milliseconds.
export function elapsedLabel(ms: number): string {
  const tenths = Math.max(0, Math.round(ms / 100));
  const h = Math.floor(tenths / 36000);
  const m = Math.floor((tenths % 36000) / 600);
  const s = Math.floor((tenths % 600) / 10);
  const t = tenths % 10;
  const ss = `${String(s).padStart(2, "0")}.${t}`;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export type SplitRow = {
  label: string; // "500 m" or "Finish"
  at: string; // ISO time passed
  elapsedMs: number; // since the start
  splitMs: number; // since the previous row (or the start)
  pacePer500Ms: number | null; // over that stretch, when its distance is known
};

// Race Day's split table: each marker passed, then the finish once in.
export function splitRows(
  startedAt: string | null,
  splits: { meters: number; passed_at: string }[],
  finishedAt: string | null,
  courseMeters: number | null
): SplitRow[] {
  if (!startedAt) return [];
  const t0 = new Date(startedAt).getTime();
  const rows: SplitRow[] = [];
  let lastAt = t0;
  let lastM = 0;
  const add = (label: string, at: string, meters: number | null) => {
    const ms = new Date(at).getTime();
    const splitMs = ms - lastAt;
    rows.push({
      label,
      at,
      elapsedMs: ms - t0,
      splitMs,
      pacePer500Ms: meters != null && meters > lastM ? (splitMs * 500) / (meters - lastM) : null,
    });
    lastAt = ms;
    if (meters != null) lastM = meters;
  };
  for (const s of [...splits].sort((a, b) => a.meters - b.meters)) add(`${s.meters} m`, s.passed_at, s.meters);
  if (finishedAt) add("Finish", finishedAt, courseMeters);
  return rows;
}
