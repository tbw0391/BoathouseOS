import "server-only";
import { cToF, compassPoint, kmhToMph, type WaterReadings } from "@/lib/waterConditions";

// Live readings for /water: a USGS river gauge (flow, level and, where the
// gauge has a sensor, water temperature) and the nearest National Weather
// Service station to it (air temperature and wind). Both are free and need
// no key; fetches are cached for 10 minutes.

const USER_AGENT = "BoathouseOS/1.0 (contact: tbw0391@gmail.com)";
const CACHE = { next: { revalidate: 600 } };

export type GaugeInfo = { name: string; lat: number; lon: number; readAt: string | null };
export type LiveWater = {
  readings: WaterReadings;
  gauge: GaugeInfo | null;
  airReadAt: string | null;
  // The weather station read, e.g. "John Glenn Columbus International Airport".
  station: string | null;
  errors: string[];
};

type UsgsSeries = {
  sourceInfo: { siteName: string; geoLocation: { geogLocation: { latitude: number; longitude: number } } };
  variable: { variableCode: { value: string }[]; noDataValue: number };
  values: { value: { value: string; dateTime: string }[] }[];
};

async function fetchJson(url: string, revalidate = CACHE.next.revalidate) {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, next: { revalidate } });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export type LiveWeather = {
  airTempF: number | null;
  windMph: number | null;
  gustMph: number | null;
  windDir: WaterReadings["windDir"];
  station: string | null;
  readAt: string | null;
  error: string | null;
};

// Air and wind from the National Weather Service station nearest a point.
export async function liveWeather(lat: number, lon: number, revalidate = CACHE.next.revalidate): Promise<LiveWeather> {
  const weather: LiveWeather = {
    airTempF: null,
    windMph: null,
    gustMph: null,
    windDir: null,
    station: null,
    readAt: null,
    error: null,
  };
  try {
    const point = await fetchJson(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`, revalidate);
    const stations = await fetchJson(point.properties.observationStations, revalidate);
    const station = stations.features?.[0]?.properties;
    const obs = await fetchJson(`https://api.weather.gov/stations/${station?.stationIdentifier}/observations/latest`, revalidate);
    const p = obs.properties;
    if (p.temperature?.value != null) weather.airTempF = cToF(p.temperature.value);
    if (p.windSpeed?.value != null) weather.windMph = kmhToMph(p.windSpeed.value);
    if (p.windGust?.value != null) weather.gustMph = kmhToMph(p.windGust.value);
    if (p.windDirection?.value != null) weather.windDir = compassPoint(p.windDirection.value);
    weather.station = station?.name ?? null;
    weather.readAt = p.timestamp ?? null;
  } catch {
    weather.error = "Couldn't reach the National Weather Service.";
  }
  return weather;
}

// revalidate: how long readings are reused, in seconds (regattas: an hour).
// weatherAt: where to read air and wind (default: the gauge). No gauge: just
// the weather.
export async function liveWater(
  gaugeSite: string | null,
  revalidate = CACHE.next.revalidate,
  weatherAt: { lat: number; lon: number } | null = null
): Promise<LiveWater> {
  const readings: WaterReadings = {
    flowCfs: null,
    heightFt: null,
    waterTempF: null,
    airTempF: null,
    windMph: null,
    gustMph: null,
    windDir: null,
  };
  const errors: string[] = [];
  let gauge: GaugeInfo | null = null;
  let airReadAt: string | null = null;
  let station: string | null = null;

  if (gaugeSite) {
    try {
      const data = await fetchJson(
        `https://waterservices.usgs.gov/nwis/iv/?format=json&siteStatus=active&parameterCd=00060,00065,00010&sites=${encodeURIComponent(gaugeSite)}`,
        revalidate
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
  }

  const at = weatherAt ?? (gauge ? { lat: gauge.lat, lon: gauge.lon } : null);
  if (at) {
    const w = await liveWeather(at.lat, at.lon, revalidate);
    readings.airTempF = w.airTempF;
    readings.windMph = w.windMph;
    readings.gustMph = w.gustMph;
    readings.windDir = w.windDir;
    airReadAt = w.readAt;
    station = w.station;
    if (w.error) errors.push(w.error);
  }

  return { readings, gauge, airReadAt, station, errors };
}

export type NearbyGauge = { site: string; name: string; km: number; flowCfs: number | null; heightFt: number | null };

// Active USGS gauges with flow or level readings within maxKm of a point (a
// regatta's course), nearest first. null when USGS couldn't be reached (it
// has short outages), as opposed to [] when there just isn't one nearby.
export async function nearbyGauges(lat: number, lon: number, maxKm = 30): Promise<NearbyGauge[] | null> {
  const dLat = 0.3;
  const dLon = 0.4;
  const bBox = [lon - dLon, lat - dLat, lon + dLon, lat + dLat].map((n) => n.toFixed(4)).join(",");
  try {
    const data = await fetchJson(
      `https://waterservices.usgs.gov/nwis/iv/?format=json&siteStatus=active&parameterCd=00060,00065&bBox=${bBox}`
    );
    const series = (data?.value?.timeSeries ?? []) as (UsgsSeries & { sourceInfo: { siteCode: { value: string }[] } })[];
    const bySite = new Map<string, NearbyGauge>();
    for (const s of series) {
      const site = s.sourceInfo.siteCode?.[0]?.value;
      const last = s.values[0]?.value.at(-1);
      const v = last ? Number(last.value) : NaN;
      if (!site || !Number.isFinite(v) || v === s.variable.noDataValue) continue;
      const loc = s.sourceInfo.geoLocation.geogLocation;
      const km = distanceKm(lat, lon, loc.latitude, loc.longitude);
      if (km > maxKm) continue;
      const g = bySite.get(site) ?? { site, name: s.sourceInfo.siteName, km, flowCfs: null, heightFt: null };
      const code = s.variable.variableCode[0]?.value;
      if (code === "00060") g.flowCfs = v;
      if (code === "00065") g.heightFt = v;
      bySite.set(site, g);
    }
    return [...bySite.values()].sort((a, b) => a.km - b.km);
  } catch {
    return null;
  }
}

// The app's guess when nobody has picked one: the biggest river (most flow)
// within 15 km, so a small creek next to the course doesn't win; else the
// nearest gauge.
export function guessGauge(gauges: NearbyGauge[]): NearbyGauge | null {
  const rivers = gauges.filter((g) => g.km <= 15 && g.flowCfs != null).sort((a, b) => b.flowCfs! - a.flowCfs!);
  return rivers[0] ?? gauges[0] ?? null;
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}
