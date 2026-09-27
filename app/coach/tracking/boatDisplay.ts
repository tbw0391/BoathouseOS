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

type PingLike = { lat: number; lng: number; speed_mps: number | null; heading_deg: number | null; recorded_at: string };

// Speed and heading from the phone when it reports them (many iPhones
// don't), otherwise worked out from the last two positions.
export function boatMotion(last: PingLike | null, prev: PingLike | null): BoatMotion {
  if (!last) return { moving: false, speedMps: null, headingDeg: null };

  const gapSec = prev ? (new Date(last.recorded_at).getTime() - new Date(prev.recorded_at).getTime()) / 1000 : 0;
  const usablePrev = prev && gapSec > 0 && gapSec <= 60 ? prev : null;

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
