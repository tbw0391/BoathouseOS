import { describe, expect, it } from "vitest";
import { driveMinutes, isArriving, isDayBefore, milesLabel, minutesLabel } from "@/lib/trailerTracking";

// Hoover Reservoir and spots up the road.
const site = { lat: 40.13, lng: -82.88 };
const north = (miles: number) => ({ lat: site.lat + miles / 69.05, lng: site.lng });

describe("isDayBefore", () => {
  const now = new Date("2026-10-09T15:00:00-04:00");

  it("is on the day before the regatta (Eastern)", () => {
    expect(isDayBefore("2026-10-10T08:00:00-04:00", now)).toBe(true);
    // A late-evening regatta start on the 10th is still the 10th in Ohio.
    expect(isDayBefore("2026-10-11T01:00:00Z", now)).toBe(true);
  });

  it("is off on race day and two days out", () => {
    expect(isDayBefore("2026-10-09T18:00:00-04:00", now)).toBe(false);
    expect(isDayBefore("2026-10-11T08:00:00-04:00", now)).toBe(false);
  });

  it("uses Eastern time late at night", () => {
    // 11:30 pm on the 9th Eastern is already the 10th in UTC.
    expect(isDayBefore("2026-10-10T08:00:00-04:00", new Date("2026-10-10T03:30:00Z"))).toBe(true);
  });

  it("handles a month end", () => {
    expect(isDayBefore("2026-11-01T08:00:00-04:00", new Date("2026-10-31T12:00:00-04:00"))).toBe(true);
  });
});

describe("arriving alert", () => {
  it("goes about 17 miles out", () => {
    expect(driveMinutes(north(17), site)).toBeCloseTo(29.5, 0);
    expect(isArriving(north(16), site, 10)).toBe(true);
    expect(isArriving(north(20), site, 10)).toBe(false);
  });

  it("ignores a rough fix", () => {
    expect(isArriving(north(2), site, 5000)).toBe(false);
    expect(isArriving(north(2), site, null)).toBe(true);
  });
});

describe("labels", () => {
  it("reads naturally", () => {
    expect(minutesLabel(0.4)).toBe("less than a minute");
    expect(minutesLabel(29.6)).toBe("30 min");
    expect(minutesLabel(60)).toBe("1 hr");
    expect(minutesLabel(95)).toBe("1 hr 35 min");
    expect(milesLabel(1609.344 * 3.25)).toBe("3.3 mi");
    expect(milesLabel(1609.344 * 42.4)).toBe("42 mi");
  });
});
