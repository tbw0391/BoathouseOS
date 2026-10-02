import { describe, expect, it } from "vitest";
import { flashesNearPoint, glmFileStart, milesBetween } from "@/lib/lightningMath";

describe("glmFileStart", () => {
  it("reads the start time from a GLM file name", () => {
    const key = "GLM-L2-LCFA/2026/275/02/OR_GLM-L2-LCFA_G19_s20262750200000_e20262750200200_c20262750200219.nc";
    expect(new Date(glmFileStart(key)!).toISOString()).toBe("2026-10-02T02:00:00.000Z");
    expect(new Date(glmFileStart("x_s20260011234567_e")!).toISOString()).toBe("2026-01-01T12:34:56.700Z");
    expect(glmFileStart("not a glm file")).toBeNull();
  });
});

describe("flashesNearPoint", () => {
  const hoover = { lat: 40.13, lon: -82.88 };
  it("ignores flashes out of range", () => {
    // Cleveland is about 115 miles away.
    expect(flashesNearPoint([{ lat: 41.5, lon: -81.69, at: 1 }], hoover, 20)).toBeNull();
  });
  it("finds the latest flash in range, with distance and direction", () => {
    const hit = flashesNearPoint(
      [
        { lat: 40.13, lon: -82.7, at: 1000 }, // ~9.5 miles east, earlier
        { lat: 40.3, lon: -82.88, at: 2000 }, // ~11.7 miles north, later
      ],
      hoover,
      20
    );
    expect(hit?.at).toBe(2000);
    expect(hit?.miles).toBeCloseTo(11.7, 0);
    expect(hit?.bearingDeg).toBeCloseTo(0, 0);
  });
  it("measures miles", () => {
    expect(milesBetween(hoover, { lat: 39.99, lon: -82.88 })).toBeCloseTo(9.7, 0);
  });
});
