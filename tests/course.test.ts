import { describe, expect, it } from "vitest";
import { courseDistanceLabel, parseCoordinates } from "@/lib/course";

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
