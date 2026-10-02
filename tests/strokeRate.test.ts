import { describe, expect, it } from "vitest";
import { metersPerStroke, rateFromTaps, speedFromFixes } from "@/lib/strokeRate";

describe("rateFromTaps", () => {
  it("needs a couple of strokes first", () => {
    expect(rateFromTaps([])).toBeNull();
    expect(rateFromTaps([0, 2000])).toBeNull();
  });
  it("averages the last few strokes", () => {
    // Every 2 s = 30 spm.
    expect(rateFromTaps([0, 2000, 4000, 6000, 8000])).toBeCloseTo(30);
    // Older, slower strokes drop out of the average.
    expect(rateFromTaps([0, 3000, 6000, 8000, 10000, 12000, 14000])).toBeCloseTo(30);
  });
  it("starts over after a pause", () => {
    expect(rateFromTaps([0, 2000, 4000, 20000, 22000])).toBeNull();
    expect(rateFromTaps([0, 2000, 4000, 20000, 22000, 24000])).toBeCloseTo(30);
  });
});

describe("metersPerStroke", () => {
  it("is speed over rate", () => {
    // 4.5 m/s at 27 spm = 10 m a stroke.
    expect(metersPerStroke(4.5, 27)).toBeCloseTo(10);
    expect(metersPerStroke(0, 27)).toBeNull();
  });
});

describe("speedFromFixes", () => {
  const fix = (at: number, lat: number, speedMps: number | null = null, accuracyM: number | null = 5) => ({
    lat,
    lng: -82.88,
    at,
    speedMps,
    accuracyM,
  });
  it("averages the phone's own speed readings", () => {
    expect(speedFromFixes([fix(0, 40, 4), fix(1000, 40, 5)], 1000)).toBeCloseTo(4.5);
  });
  it("works it out from distance when the phone gives no speed", () => {
    // 0.0005° of latitude is about 55.6 m, over 10 s.
    expect(speedFromFixes([fix(0, 40), fix(10000, 40.0005)], 10000)).toBeCloseTo(5.56, 1);
  });
  it("ignores old and blurry fixes", () => {
    expect(speedFromFixes([fix(0, 40, 4)], 20000)).toBeNull();
    expect(speedFromFixes([fix(0, 40, 4, 500)], 0)).toBeNull();
  });
});
