import "server-only";
import { cToF, kmhToMph, type WaterReadings } from "@/lib/waterConditions";

// Live readings for /water: a USGS river gauge (flow, level and, where the
// gauge has a sensor, water temperature) and the nearest National Weather
// Service station to it (air temperature and wind). Both are free and need
// no key; fetches are cached for 10 minutes.

const USER_AGENT = "BoathouseOS/1.0 (contact: tbw0391@gmail.com)";
const CACHE = { next: { revalidate: 600 } };

export type GaugeInfo = { name: string; lat: number; lon: number; readAt: string | null };
export type LiveWater = { readings: WaterReadings; gauge: GaugeInfo | null; airReadAt: string | null; errors: string[] };

type UsgsSeries = {
  sourceInfo: { siteName: string; geoLocation: { geogLocation: { latitude: number; longitude: number } } };
  variable: { variableCode: { value: string }[]; noDataValue: number };
  values: { value: { value: string; dateTime: string }[] }[];
};

async function fetchJson(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, ...CACHE });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export async function liveWater(gaugeSite: string): Promise<LiveWater> {
  const readings: WaterReadings = { flowCfs: null, heightFt: null, waterTempF: null, airTempF: null, windMph: null, gustMph: null };
  const errors: string[] = [];
  let gauge: GaugeInfo | null = null;
  let airReadAt: string | null = null;

  try {
    const data = await fetchJson(
      `https://waterservices.usgs.gov/nwis/iv/?format=json&siteStatus=active&parameterCd=00060,00065,00010&sites=${encodeURIComponent(gaugeSite)}`
    );
    const series = (data?.value?.timeSeries ?? []) as UsgsSeries[];
    for (const s of series) {
      const code = s.variable.variableCode[0]?.value;
      const last = s.values[0]?.value.at(-1);
      const v = last ? Number(last.value) : NaN;
      if (!last || !Number.isFinite(v) || v === s.variable.noDataValue) continue;
      if (code === "00060") readings.flowCfs = v;
      if (code === "00065") readings.heightFt = v;
      if (code === "00010") readings.waterTempF = cToF(v);
      const loc = s.sourceInfo.geoLocation.geogLocation;
      gauge = { name: s.sourceInfo.siteName, lat: loc.latitude, lon: loc.longitude, readAt: last.dateTime };
    }
    if (!gauge) errors.push("The river gauge isn't reporting right now.");
  } catch {
    errors.push("Couldn't reach the USGS river gauge.");
  }

  if (gauge) {
    try {
      const point = await fetchJson(`https://api.weather.gov/points/${gauge.lat.toFixed(4)},${gauge.lon.toFixed(4)}`);
      const stations = await fetchJson(point.properties.observationStations);
      const stationId = stations.features?.[0]?.properties?.stationIdentifier;
      const obs = await fetchJson(`https://api.weather.gov/stations/${stationId}/observations/latest`);
      const p = obs.properties;
      if (p.temperature?.value != null) readings.airTempF = cToF(p.temperature.value);
      if (p.windSpeed?.value != null) readings.windMph = kmhToMph(p.windSpeed.value);
      if (p.windGust?.value != null) readings.gustMph = kmhToMph(p.windGust.value);
      airReadAt = p.timestamp ?? null;
    } catch {
      errors.push("Couldn't reach the National Weather Service.");
    }
  }

  return { readings, gauge, airReadAt, errors };
}
