// Shared by the live boat list and its map.
export const STALE_AFTER_MS = 60000;

export const FALLBACK_COLOR = "#6b7280";

export function ageLabel(iso: string) {
  const sec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  return sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)} min`;
}

// Colors come from the database (a coxswain could write anything there), so
// only a plain #rrggbb is ever put into a style.
export const boatColor = (color: string | null) =>
  color && /^#[0-9a-f]{6}$/i.test(color) ? color : FALLBACK_COLOR;

// Below this a boat is drifting or GPS is wobbling, not rowing (~1 knot).
const MOVING_MPS = 0.5;

const toRad = (deg: number) => (deg * Math.PI) / 180;

function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

function bearing(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export interface BoatMotion {
  moving: boolean;
  speedMps: number | null;
  headingDeg: number | null;
}

type PingLike = {
  lat: number;
  lng: number;
  accuracy_m: number | null;
  speed_mps: number | null;
  heading_deg: number | null;
  recorded_at: string;
};

const isGoodFix = (p: PingLike) => p.accuracy_m != null && p.accuracy_m <= GOOD_FIX_M;

// Speed and heading from the phone when it reports them (many iPhones
// don't), otherwise worked out from the last two positions. Blurry fixes
// give nothing: two ±1 km guesses would show a boat doing 60 mph.
export function boatMotion(last: PingLike | null, prev: PingLike | null): BoatMotion {
  if (!last || isApproximate(last.accuracy_m)) return { moving: false, speedMps: null, headingDeg: null };

  const gapSec = prev ? (new Date(last.recorded_at).getTime() - new Date(prev.recorded_at).getTime()) / 1000 : 0;
  const usablePrev = prev && gapSec > 0 && gapSec <= 60 && isGoodFix(prev) && isGoodFix(last) ? prev : null;

  const speedMps =
    last.speed_mps != null && last.speed_mps >= 0
      ? last.speed_mps
      : usablePrev
        ? metersBetween(usablePrev, last) / gapSec
        : null;
  if (speedMps == null) return { moving: false, speedMps: null, headingDeg: null };

  const moving = speedMps >= MOVING_MPS;
  const headingDeg = !moving
    ? null
    : last.heading_deg != null && !Number.isNaN(last.heading_deg)
      ? last.heading_deg
      : usablePrev
        ? bearing(usablePrev, last)
        : null;
  return { moving, speedMps, headingDeg };
}

// Rowing split: time to cover 500 m at this speed, e.g. "2:05".
export function split500(speedMps: number) {
  const sec = Math.round(500 / speedMps);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

export const mph = (speedMps: number) => (speedMps * 2.23694).toFixed(1);

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
export const compass = (deg: number) => COMPASS[Math.round(deg / 45) % 8];

// How far off a fix may be, in meters, before it's no use for a boat. A
// phone with real GPS outdoors reports ~3–15 m; iPhone "Precise Location"
// off or a laptop's Wi-Fi guess reports hundreds or thousands.
export const GOOD_FIX_M = 25;
export const APPROXIMATE_FIX_M = 100;

export const isApproximate = (accuracyM: number | null) => accuracyM != null && accuracyM > APPROXIMATE_FIX_M;

export const distanceLabel = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);
