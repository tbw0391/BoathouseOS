// Practice go/no-go (/water): the club's limits, and the verdict from the
// latest river gauge and weather readings. Admins set the limits; a blank
// limit isn't checked.

export const WATER_SETTINGS_KEY = "water_conditions";
export const LIGHTNING_WAIT_MINUTES = 30;

export type WaterSettings = {
  gaugeSite: string | null; // USGS site number, e.g. "03049500"
  flowCautionCfs: number | null;
  flowStopCfs: number | null;
  heightCautionFt: number | null;
  heightStopFt: number | null;
  // Air + water temperature (°F). Below caution: the cold-water rule.
  combinedCautionF: number | null;
  combinedStopF: number | null;
  windCautionMph: number | null;
  windStopMph: number | null;
};

export const DEFAULT_WATER_SETTINGS: WaterSettings = {
  gaugeSite: null,
  flowCautionCfs: null,
  flowStopCfs: null,
  heightCautionFt: null,
  heightStopFt: null,
  combinedCautionF: 100,
  combinedStopF: null,
  windCautionMph: 15,
  windStopMph: 25,
};

export function parseWaterSettings(raw: string | null | undefined): WaterSettings {
  let saved: Record<string, unknown> = {};
  try {
    saved = JSON.parse(raw ?? "{}") ?? {};
  } catch {
    saved = {};
  }
  const num = (k: keyof WaterSettings) => {
    if (!(k in saved)) return DEFAULT_WATER_SETTINGS[k] as number | null;
    const v = saved[k];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };
  const site = typeof saved.gaugeSite === "string" && /^\d{8,15}$/.test(saved.gaugeSite) ? saved.gaugeSite : null;
  return {
    gaugeSite: site,
    flowCautionCfs: num("flowCautionCfs"),
    flowStopCfs: num("flowStopCfs"),
    heightCautionFt: num("heightCautionFt"),
    heightStopFt: num("heightStopFt"),
    combinedCautionF: num("combinedCautionF"),
    combinedStopF: num("combinedStopF"),
    windCautionMph: num("windCautionMph"),
    windStopMph: num("windStopMph"),
  };
}

export type WaterReadings = {
  flowCfs: number | null;
  heightFt: number | null;
  waterTempF: number | null;
  airTempF: number | null;
  windMph: number | null;
  gustMph: number | null;
};

export type Verdict = "go" | "caution" | "no-go" | "unknown";
export type Reason = { level: "caution" | "no-go"; text: string };

export function evaluateWater(r: WaterReadings, s: WaterSettings): { verdict: Verdict; reasons: Reason[] } {
  const reasons: Reason[] = [];
  const check = (value: number | null, caution: number | null, stop: number | null, what: (v: number) => string, below = false) => {
    if (value == null) return;
    const over = (limit: number | null) => limit != null && (below ? value < limit : value >= limit);
    if (over(stop)) reasons.push({ level: "no-go", text: what(value) });
    else if (over(caution)) reasons.push({ level: "caution", text: what(value) });
  };

  check(r.flowCfs, s.flowCautionCfs, s.flowStopCfs, (v) => `River flow is ${Math.round(v).toLocaleString()} cfs`);
  check(r.heightFt, s.heightCautionFt, s.heightStopFt, (v) => `River level is ${v.toFixed(1)} ft`);
  const wind = Math.max(r.windMph ?? -1, r.gustMph ?? -1);
  check(wind >= 0 ? wind : null, s.windCautionMph, s.windStopMph, (v) => `Wind up to ${Math.round(v)} mph`);
  if (r.airTempF != null && r.waterTempF != null) {
    check(
      r.airTempF + r.waterTempF,
      s.combinedCautionF,
      s.combinedStopF,
      (v) => `Air + water is ${Math.round(v)}°F (cold-water rule)`,
      true
    );
  }

  const known = [r.flowCfs, r.heightFt, r.windMph, r.airTempF].some((v) => v != null);
  const verdict: Verdict = reasons.some((x) => x.level === "no-go")
    ? "no-go"
    : reasons.length > 0
      ? "caution"
      : known
        ? "go"
        : "unknown";
  return { verdict, reasons };
}

// Minutes left before crews can go back out, or 0 once 30 minutes have
// passed since the last thunder or lightning.
export function lightningMinutesLeft(lastStrikeAt: string, now: Date = new Date()): number {
  const left = LIGHTNING_WAIT_MINUTES * 60 * 1000 - (now.getTime() - new Date(lastStrikeAt).getTime());
  return left > 0 ? Math.ceil(left / 60000) : 0;
}

export const cToF = (c: number) => (c * 9) / 5 + 32;
export const kmhToMph = (k: number) => k / 1.609344;

export const PRACTICE_CALL_LABELS: Record<string, string> = {
  go: "On the water",
  caution: "On the water, with extra care",
  land: "Land workout instead",
  cancelled: "Practice cancelled",
};
