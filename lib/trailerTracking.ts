// Trailer tracking (0132): where the boat and food trailers are on the way
// to a regatta, and when they're close enough to call people over to unload.

import type { TrailerKindTracked } from "@/lib/database.types";

export const TRACKED_TRAILERS: TrailerKindTracked[] = ["boat", "food"];

export const TRAILER_NAMES: Record<TrailerKindTracked, string> = {
  boat: "Boat trailer",
  food: "Food trailer",
};

// Everyone's told to come help unload when the trailer is this close.
export const ARRIVING_ALERT_MINUTES = 30;

// Roads wind, so the drive is longer than the straight line, and a towed
// trailer averages well under the speed limit. 1.3x at 45 mph puts the
// 30-minute alert about 17 miles out in a straight line.
const ROAD_FACTOR = 1.3;
const TRAILER_AVG_MPS = 45 * 0.44704;

// A fix rougher than this (no GPS, a laptop) says nothing useful about
// how far away the trailer is.
export const MAX_USABLE_ACCURACY_M = 1000;

export type LatLng = { lat: number; lng: number };

const toRad = (deg: number) => (deg * Math.PI) / 180;

export function metersBetween(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

// Rough minutes of driving from here to the regatta.
export function driveMinutes(from: LatLng, to: LatLng): number {
  return (metersBetween(from, to) * ROAD_FACTOR) / TRAILER_AVG_MPS / 60;
}

export function isArriving(from: LatLng, to: LatLng, accuracyM: number | null): boolean {
  if (accuracyM != null && accuracyM > MAX_USABLE_ACCURACY_M) return false;
  return driveMinutes(from, to) <= ARRIVING_ALERT_MINUTES;
}

export function milesLabel(m: number): string {
  const mi = m / 1609.344;
  return mi < 10 ? `${mi.toFixed(1)} mi` : `${Math.round(mi)} mi`;
}

export function minutesLabel(min: number): string {
  if (min < 1) return "less than a minute";
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

// YYYY-MM-DD in Eastern time (the club's time zone).
export function easternDay(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

// Tracking is on the day before the regatta only (start_trailer_trip
// checks the same in the database).
export function isDayBefore(regattaStartsAt: string | Date, now: Date = new Date()): boolean {
  const tomorrow = new Date(`${easternDay(now)}T12:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return easternDay(new Date(regattaStartsAt)) === tomorrow.toISOString().slice(0, 10);
}
