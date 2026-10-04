import { describe, expect, it } from "vitest";
import { courseLine, distanceM, markersOnLine, parseDistances, pointAlong } from "@/lib/riverPath";

// An L-shaped river: north for ~1.1 km, then east for ~1.7 km, drawn as two
// OpenStreetMap ways that meet at the bend, plus an unrelated creek.
const north = [
  { lat: 39.995, lng: -83.0 },
  { lat: 40.0, lng: -83.0 },
  { lat: 40.005, lng: -83.0 },
  { lat: 40.01, lng: -83.0 },
];
const east = [
  { lat: 40.01, lng: -83.0 },
  { lat: 40.01, lng: -82.99 },
  { lat: 40.01, lng: -82.98 },
  { lat: 40.01, lng: -82.97 },
];
const creek = [
  { lat: 40.03, lng: -83.05 },
  { lat: 40.04, lng: -83.05 },
];

describe("markers along the river", () => {
  const start = { lat: 40.0001, lng: -83.0002 }; // a few metres off the centerline
  const finish = { lat: 40.0101, lng: -82.98 };

  it("follows the bend instead of cutting across", () => {
    const line = courseLine(start, finish, [north, east, creek]);
    expect(line.followsRiver).toBe(true);
    expect(line.lengthM).toBeGreaterThan(distanceM(start, finish) * 1.3);
    const ms = markersOnLine(line, [500, 1000, 2000, 3000, 4000]);
    expect(ms.map((m) => m.m)).toEqual([500, 1000, 2000]); // 3000 and 4000 are past the finish
    expect(ms[0].lng).toBeCloseTo(-83.0, 3); // still on the northbound stretch
    expect(ms[2].lat).toBeCloseTo(40.01, 3); // round the bend, heading east
    expect(ms[2].lng).toBeGreaterThan(-83.0);
  });

  it("uses the straight line with no river nearby or a straight river", () => {
    expect(courseLine(start, finish, []).followsRiver).toBe(false);
    expect(courseLine(start, finish, [creek]).followsRiver).toBe(false);
    const s = courseLine({ lat: 40.0, lng: -83.0 }, { lat: 40.01, lng: -83.0 }, [north]);
    expect(s.followsRiver).toBe(false);
    expect(markersOnLine(s, [500])[0].lat).toBeCloseTo(40.0045, 3);
  });

  it("finds points along a path and reads distance lists", () => {
    expect(pointAlong([{ lat: 40, lng: -83 }, { lat: 40.01, lng: -83 }], 5000)).toBeNull();
    expect(parseDistances("500, 1000 2000;3000 4000m")).toEqual([500, 1000, 2000, 3000, 4000]);
  });
});
