// Boat usage (Boats page): distance and time on the water from On the
// Water outings, and whether a boat is due for service.

export type Outing = { boat_id: string | null; started_at: string; ended_at: string | null; meters: number | null };

export type BoatUsage = { outings: number; km: number; hours: number; kmSinceService: number; due: boolean };

export function boatUsage(
  boat: { id: string; service_every_km: number | null; last_service_at: string | null },
  outings: Outing[],
  since: Date
): BoatUsage {
  let outCount = 0;
  let meters = 0;
  let ms = 0;
  let sinceService = 0;
  for (const o of outings) {
    if (o.boat_id !== boat.id || !o.ended_at) continue;
    const start = new Date(o.started_at);
    if (start >= since) {
      outCount++;
      meters += o.meters ?? 0;
      ms += new Date(o.ended_at).getTime() - start.getTime();
    }
    if (!boat.last_service_at || start > new Date(boat.last_service_at)) sinceService += o.meters ?? 0;
  }
  const kmSinceService = sinceService / 1000;
  return {
    outings: outCount,
    km: meters / 1000,
    hours: ms / 3600000,
    kmSinceService,
    due: boat.service_every_km != null && kmSinceService >= boat.service_every_km,
  };
}

export const SERVICE_INTERVAL_OPTIONS = [250, 500, 1000, 2000];
