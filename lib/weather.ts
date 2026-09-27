import "server-only";
import type { EventForecast, ScheduleEvent } from "@/lib/database.types";

type SupabaseClient = Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>;

// api.weather.gov (National Weather Service) and Nominatim (OpenStreetMap
// geocoding) both require a descriptive User-Agent identifying the app and
// a contact — no API key needed for either, but requests without one get
// throttled or blocked.
const USER_AGENT = "BoathouseOS/1.0 (contact: tbw0391@gmail.com)";

// NWS only forecasts about a week out — no point calling out past that.
const FORECAST_HORIZON_DAYS = 7;
const CACHE_TTL_MS = 3 * 60 * 60 * 1000;

// Calendar dates are Eastern, where the club rows — not the server's UTC —
// so "today" and a regatta's days flip at local midnight.
function easternDate(when: string | Date): string {
  return new Date(when).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function daysBetween(fromDate: string, toDate: string): number {
  return Math.round((Date.parse(`${toDate}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`)) / (24 * 60 * 60 * 1000));
}

// The regatta day to forecast: its first day until then, then each race day
// in turn (Sunday of a two-day regatta), or null once its last day is over.
export function forecastDayFor(event: Pick<ScheduleEvent, "starts_at" | "ends_at">): string | null {
  const today = easternDate(new Date());
  const firstDay = easternDate(event.starts_at);
  const lastDay = easternDate(event.ends_at ?? event.starts_at);
  const day = today > firstDay ? today : firstDay;
  return day > lastDay ? null : day;
}

async function geocodeLocation(location: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(location)}`;
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return null;
    const data = (await res.json()) as { lat: string; lon: string }[];
    if (!data[0]) return null;
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

interface NwsPeriod {
  startTime: string;
  isDaytime: boolean;
  temperature: number;
  shortForecast: string;
  windSpeed: string;
  icon: string;
  probabilityOfPrecipitation?: { value: number | null };
}

async function fetchNwsPeriods(lat: number, lon: number): Promise<NwsPeriod[] | null> {
  try {
    const pointRes = await fetch(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/geo+json" },
    });
    if (!pointRes.ok) return null;
    const pointData = await pointRes.json();
    const forecastUrl = pointData?.properties?.forecast as string | undefined;
    if (!forecastUrl) return null;

    const forecastRes = await fetch(forecastUrl, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/geo+json" },
    });
    if (!forecastRes.ok) return null;
    const forecastData = await forecastRes.json();
    return (forecastData?.properties?.periods as NwsPeriod[] | undefined) ?? null;
  } catch {
    return null;
  }
}

// Returns the cached forecast for a regatta's day, refreshing it (geocoding
// the location once, then pulling the NWS forecast) whenever the cache is
// missing, stale, or the event's location text changed. Callers just call
// this on every home-page load — most calls hit the cache and skip the
// network entirely.
export async function getOrRefreshEventForecast(
  supabase: SupabaseClient,
  event: ScheduleEvent
): Promise<EventForecast | null> {
  if (!event.location) return null;

  const forecastDay = forecastDayFor(event);
  if (!forecastDay || daysBetween(easternDate(new Date()), forecastDay) > FORECAST_HORIZON_DAYS) return null;

  const { data: existingRow } = await supabase
    .from("event_forecasts")
    .select("*")
    .eq("event_id", event.id)
    .maybeSingle();
  const existing = existingRow as EventForecast | null;

  const locationChanged = existing?.geocoded_location !== event.location;
  // A new race day (midnight, or day 2 of a regatta) needs its own forecast
  // right away, not whenever the cache happens to expire.
  const stale =
    !existing ||
    locationChanged ||
    existing.forecast_date !== forecastDay ||
    Date.now() - new Date(existing.fetched_at).getTime() > CACHE_TTL_MS;
  if (!stale) return existing;

  let lat = !locationChanged ? existing?.latitude ?? null : null;
  let lon = !locationChanged ? existing?.longitude ?? null : null;
  if (lat === null || lon === null) {
    const geo = await geocodeLocation(event.location);
    if (!geo) {
      // Cache the miss too (bad/unrecognized location text), so a broken
      // address doesn't get re-geocoded on every single page load.
      const { data: upserted } = await supabase
        .from("event_forecasts")
        .upsert(
          {
            event_id: event.id,
            geocoded_location: event.location,
            forecast_date: forecastDay,
            fetched_at: new Date().toISOString(),
          },
          { onConflict: "event_id" }
        )
        .select("*")
        .single();
      return (upserted as EventForecast | null) ?? existing ?? null;
    }
    lat = geo.lat;
    lon = geo.lon;
  }

  const periods = await fetchNwsPeriods(lat, lon);
  const dayPeriod = periods?.find((p) => easternDate(p.startTime) === forecastDay && p.isDaytime);
  const nightPeriod = periods?.find((p) => easternDate(p.startTime) === forecastDay && !p.isDaytime);
  const primary = dayPeriod ?? nightPeriod ?? null;

  const row = {
    event_id: event.id,
    geocoded_location: event.location,
    latitude: lat,
    longitude: lon,
    forecast_date: forecastDay,
    high_f: dayPeriod?.temperature ?? primary?.temperature ?? null,
    low_f: nightPeriod?.temperature ?? null,
    short_forecast: primary?.shortForecast ?? null,
    precipitation_chance: primary?.probabilityOfPrecipitation?.value ?? null,
    wind: primary?.windSpeed ?? null,
    icon_url: primary?.icon ?? null,
    fetched_at: new Date().toISOString(),
  };

  const { data: upserted } = await supabase
    .from("event_forecasts")
    .upsert(row, { onConflict: "event_id" })
    .select("*")
    .single();

  return (upserted as EventForecast | null) ?? (row as unknown as EventForecast);
}
