import { describe, expect, it } from "vitest";
import {
  ergWatts,
  formatErgTime,
  tidyErgTime,
  parseConcept2Csv,
  parseErgTime,
  split500,
  testDistance,
  weightAdjusted,
} from "@/lib/erg";

describe("erg times", () => {
  it("parses and formats", () => {
    expect(parseErgTime("6:45.2")).toBe(405.2);
    expect(parseErgTime("1:02:03")).toBe(3723);
    expect(parseErgTime("95.5")).toBe(95.5);
    expect(parseErgTime("6:75")).toBeNull();
    expect(parseErgTime("fast")).toBeNull();
    expect(formatErgTime(405.2)).toBe("6:45.2");
    expect(formatErgTime(3723)).toBe("1:02:03.0");
    expect(formatErgTime(62)).toBe("1:02.0");
  });

  it("works out split, watts and weight adjustment", () => {
    expect(split500(2000, 400)).toBe(100);
    expect(ergWatts(2000, 400)).toBe(350);
    expect(weightAdjusted(400, 270)).toBe(400);
    expect(weightAdjusted(400, 150)).toBeLessThan(400);
  });

  it("spots 2K and 5K tests", () => {
    expect(testDistance(2000, "2K")).toBe("2k");
    expect(testDistance(5000, "5K test")).toBe("5k");
    expect(testDistance(2000, "4x2000m")).toBeNull();
  });
});

describe("parseConcept2Csv", () => {
  it("reads RowErg pieces and skips other machines", () => {
    const csv = [
      '"ID","Date","Description","Work Time (Formatted)","Work Time (Seconds)","Work Distance","Stroke Rate/Cadence","Type","Comments"',
      '"101","2026-09-20 16:30:00","2000m","6:45.2","405.2","2,000","31","RowErg","test day, felt good"',
      '"102","2026-09-21 07:00:00","30:00","30:00.0","1800","7,512","22","RowErg",""',
      '"103","2026-09-22 07:00:00","5000m","","900","5000","","SkiErg",""',
    ].join("\r\n");
    const rows = parseConcept2Csv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      sourceRef: "c2:101",
      doneOn: "2026-09-20",
      piece: "2000m",
      distanceM: 2000,
      timeSeconds: 405.2,
      strokeRate: 31,
      notes: "test day, felt good",
    });
    expect(rows[1].distanceM).toBe(7512);
  });

  it("returns nothing for a file that isn't a logbook export", () => {
    expect(parseConcept2Csv("name,email\nA,b@c.d")).toEqual([]);
  });
});

describe("dots for colons (phone number pad)", () => {
  it("reads dotted times", () => {
    expect(parseErgTime("6.45.2")).toBe(405.2);
    expect(parseErgTime("6.45")).toBe(405);
    expect(parseErgTime("1.02.03")).toBe(3723);
    expect(parseErgTime("18.20.5")).toBe(1100.5);
    expect(parseErgTime("95.5")).toBe(95.5);
    expect(parseErgTime("6:45.2")).toBe(405.2);
  });

  it("tidies a dotted time for display", () => {
    expect(tidyErgTime("6.45.2")).toBe("6:45.2");
    expect(tidyErgTime("nope")).toBe("nope");
  });
});
