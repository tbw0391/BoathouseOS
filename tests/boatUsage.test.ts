import { describe, expect, it } from "vitest";
import { boatUsage } from "@/lib/boatUsage";

const outings = [
  { boat_id: "b1", started_at: "2026-09-01T20:00:00Z", ended_at: "2026-09-01T21:30:00Z", meters: 12000 },
  { boat_id: "b1", started_at: "2026-09-10T20:00:00Z", ended_at: "2026-09-10T21:00:00Z", meters: 9000 },
  { boat_id: "b1", started_at: "2025-06-01T20:00:00Z", ended_at: "2025-06-01T21:00:00Z", meters: 10000 },
  { boat_id: "b2", started_at: "2026-09-10T20:00:00Z", ended_at: "2026-09-10T21:00:00Z", meters: 5000 },
  { boat_id: "b1", started_at: "2026-09-20T20:00:00Z", ended_at: null, meters: null },
];
const since = new Date("2025-09-28T00:00:00Z");

describe("boatUsage", () => {
  it("adds up the last year's outings for one boat", () => {
    const u = boatUsage({ id: "b1", service_every_km: null, last_service_at: null }, outings, since);
    expect(u).toMatchObject({ outings: 2, km: 21, hours: 2.5, kmSinceService: 31, due: false });
  });

  it("counts distance since the last service against the interval", () => {
    const u = boatUsage({ id: "b1", service_every_km: 20, last_service_at: "2026-08-01T00:00:00Z" }, outings, since);
    expect(u.kmSinceService).toBe(21);
    expect(u.due).toBe(true);
    const later = boatUsage({ id: "b1", service_every_km: 20, last_service_at: "2026-09-05T00:00:00Z" }, outings, since);
    expect(later.due).toBe(false);
  });
});
