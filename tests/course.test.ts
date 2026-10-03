import { describe, expect, it } from "vitest";
import {
  courseDistanceLabel,
  crossingTime,
  elapsedLabel,
  markersAlongLine,
  parseCoordinates,
  parseCourseMarkers,
  pastMarkerM,
  splitRows,
} from "@/lib/course";

describe("parseCoordinates", () => {
  it("reads decimal degrees from Google Maps", () => {
    expect(parseCoordinates("40.4468, -80.0123")).toEqual({ lat: 40.4468, lng: -80.0123 });
    expect(parseCoordinates(" 40.4468 -80.0123 ")).toEqual({ lat: 40.4468, lng: -80.0123 });
  });

  it("reads hemisphere letters", () => {
    expect(parseCoordinates("40.4468 N, 80.0123 W")).toEqual({ lat: 40.4468, lng: -80.0123 });
    expect(parseCoordinates("80.0123W 40.4468N")).toEqual({ lat: 40.4468, lng: -80.0123 });
  });

  it("reads degrees, minutes and seconds", () => {
    const p = parseCoordinates(`40°26'48"N 80°0'36"W`)!;
    expect(p.lat).toBeCloseTo(40.44667, 4);
    expect(p.lng).toBeCloseTo(-80.01, 4);
  });

  it("reads degrees and decimal minutes", () => {
    const p = parseCoordinates("40° 26.8' N, 80° 0.6' W")!;
    expect(p.lat).toBeCloseTo(40.44667, 4);
    expect(p.lng).toBeCloseTo(-80.01, 4);
  });

  it("rejects anything else", () => {
    expect(parseCoordinates("")).toBeNull();
    expect(parseCoordinates("40.4468")).toBeNull();
    expect(parseCoordinates("Pittsburgh, PA")).toBeNull();
    expect(parseCoordinates("95, -80")).toBeNull();
    expect(parseCoordinates("1, 2, 3")).toBeNull();
  });
});

describe("courseDistanceLabel", () => {
  it("shows km over a kilometre and metres under", () => {
    expect(courseDistanceLabel({ lat: 40, lng: -80 }, { lat: 40.01, lng: -80 })).toBe("1.1 km");
    expect(courseDistanceLabel({ lat: 40, lng: -80 }, { lat: 40.001, lng: -80 })).toBe("111 m");
  });
});

describe("course markers", () => {
  it("tidies saved markers into course order, one per distance", () => {
    expect(
      parseCourseMarkers([
        { m: 1000, lat: 40.1, lng: -83 },
        { m: "500", lat: "40.05", lng: "-83" },
        { m: 1000, lat: 41, lng: -84 },
        { m: 0, lat: 40, lng: -83 },
        { m: 1500, lat: 95, lng: -83 },
        "junk",
      ])
    ).toEqual([
      { m: 500, lat: 40.05, lng: -83 },
      { m: 1000, lat: 40.1, lng: -83 },
    ]);
    expect(parseCourseMarkers(null)).toEqual([]);
  });

  it("lays markers along a straight course", () => {
    const ms = markersAlongLine({ lat: 40, lng: -83 }, { lat: 40.02, lng: -83 }, 2000, 500);
    expect(ms.map((m) => m.m)).toEqual([500, 1000, 1500]);
    expect(ms[1].lat).toBeCloseTo(40.01, 6);
    expect(markersAlongLine({ lat: 40, lng: -83 }, { lat: 40.02, lng: -83 }, 2000, 0)).toEqual([]);
  });

  it("measures distance past a marker along the course", () => {
    const a = { lat: 40, lng: -83 };
    const m = { lat: 40.005, lng: -83 };
    const b = { lat: 40.01, lng: -83 };
    // 0.001° of latitude is about 111 m.
    expect(pastMarkerM({ lat: 40.004, lng: -83 }, m, a, b)!).toBeCloseTo(-111.3, 0);
    expect(pastMarkerM({ lat: 40.006, lng: -83.0005 }, m, a, b)!).toBeCloseTo(111.3, 0); // off to the side still counts by distance along
    expect(pastMarkerM(m, m, a, a)).toBeNull();
  });

  it("works out the crossing time between two pings", () => {
    expect(crossingTime({ at: 0, past: -10 }, { at: 7000, past: 25 })).toBe(2000);
    expect(crossingTime({ at: 0, past: 5 }, { at: 7000, past: 25 })).toBeNull();
    expect(crossingTime({ at: 0, past: -30 }, { at: 7000, past: -5 })).toBeNull();
  });

  it("formats elapsed times", () => {
    expect(elapsedLabel(112300)).toBe("1:52.3");
    expect(elapsedLabel(724000)).toBe("12:04.0");
    expect(elapsedLabel(3735000)).toBe("1:02:15.0");
  });

  it("builds split rows with pace per 500", () => {
    const rows = splitRows(
      "2026-10-03T13:00:00.000Z",
      [
        { meters: 1000, passed_at: "2026-10-03T13:03:40.000Z" },
        { meters: 500, passed_at: "2026-10-03T13:01:50.000Z" },
      ],
      "2026-10-03T13:07:20.000Z",
      2000
    );
    expect(rows.map((r) => r.label)).toEqual(["500 m", "1000 m", "Finish"]);
    expect(rows.map((r) => r.splitMs)).toEqual([110000, 110000, 220000]);
    expect(rows[2].elapsedMs).toBe(440000);
    expect(rows[2].pacePer500Ms).toBe(110000);
    expect(splitRows(null, [], null, null)).toEqual([]);
  });
});
