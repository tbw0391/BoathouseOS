import { describe, expect, it } from "vitest";
import {
  DEFAULT_WATER_SETTINGS,
  evaluateWater,
  callConditionsLine,
  compassPoint,
  lightningMinutesLeft,
  parseWaterSettings,
  type WaterReadings,
} from "@/lib/waterConditions";

const calm: WaterReadings = {
  flowCfs: 9000,
  heightFt: 10,
  waterTempF: 65,
  airTempF: 70,
  windMph: 5,
  gustMph: null,
  windDir: null,
};
const limits = { ...DEFAULT_WATER_SETTINGS, flowCautionCfs: 20000, flowStopCfs: 35000 };

describe("evaluateWater", () => {
  it("is go when nothing is over a limit", () => {
    expect(evaluateWater(calm, limits)).toEqual({ verdict: "go", reasons: [] });
  });

  it("flags high flow as caution, then no-go", () => {
    expect(evaluateWater({ ...calm, flowCfs: 22000 }, limits).verdict).toBe("caution");
    const r = evaluateWater({ ...calm, flowCfs: 40000 }, limits);
    expect(r.verdict).toBe("no-go");
    expect(r.reasons[0].text).toContain("40,000 cfs");
  });

  it("applies the cold-water rule to air plus water", () => {
    const r = evaluateWater({ ...calm, airTempF: 50, waterTempF: 45 }, limits);
    expect(r.verdict).toBe("caution");
    expect(r.reasons[0].text).toContain("95°F");
  });

  it("uses the gust when it's higher than the wind", () => {
    expect(evaluateWater({ ...calm, windMph: 10, gustMph: 27 }, limits).verdict).toBe("no-go");
  });

  it("is unknown with no readings", () => {
    const none = { flowCfs: null, heightFt: null, waterTempF: null, airTempF: null, windMph: null, gustMph: null, windDir: null };
    expect(evaluateWater(none, limits).verdict).toBe("unknown");
  });
});

describe("parseWaterSettings", () => {
  it("fills in defaults and lets an admin blank a limit", () => {
    expect(parseWaterSettings(null).combinedCautionF).toBe(100);
    expect(parseWaterSettings(JSON.stringify({ combinedCautionF: null })).combinedCautionF).toBeNull();
    expect(parseWaterSettings(JSON.stringify({ gaugeSite: "03049500" })).gaugeSite).toBe("03049500");
    expect(parseWaterSettings(JSON.stringify({ gaugeSite: "x; drop" })).gaugeSite).toBeNull();
  });
});

describe("lightningMinutesLeft", () => {
  it("counts down 30 minutes from the last strike", () => {
    const now = new Date("2026-09-28T16:00:00Z");
    expect(lightningMinutesLeft("2026-09-28T15:50:00Z", now)).toBe(20);
    expect(lightningMinutesLeft("2026-09-28T15:30:00Z", now)).toBe(0);
  });
});

describe("compassPoint", () => {
  it("rounds degrees to the nearest of 8 points", () => {
    expect(compassPoint(0)).toBe("N");
    expect(compassPoint(350)).toBe("N");
    expect(compassPoint(44)).toBe("NE");
    expect(compassPoint(180)).toBe("S");
    expect(compassPoint(292)).toBe("W");
    expect(compassPoint(-45)).toBe("NW");
  });
});

describe("callConditionsLine", () => {
  it("lists what the coach entered", () => {
    expect(callConditionsLine({ water_temp_f: "61.6", air_temp_f: 70, wind_mph: 8, wind_dir: "NW" })).toBe(
      "Water 62°F · Air 70°F · Wind 8 mph NW"
    );
    expect(callConditionsLine({ wind_dir: "S" })).toBe("Wind from the S");
    expect(callConditionsLine({})).toBe("");
  });
});
