import "server-only";
import type { EventForecast, ScheduleEvent } from "@/lib/database.types";

type SupabaseClient = Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>;

// api.weather.gov (National Weather Service) and Nominatim (OpenStreetMap
// geocoding) both require a descriptive User-Agent identifying the app and
// a contact — no API key needed for either, but requests without one get
// throttled or blocked.
const USER_AGENT = "WestervilleCrewApp/1.0 (contact: tbw0391@gmail.com)";

// NWS only forecasts about a week out — no point calling out past that.
const FORECAST_HORIZON_DAYS = 7;
const CACHE_TTL_MS = 3 * 60 * 60 * 1000;

function localDateKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US");
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

  // Calendar-day difference, not a raw instant subtraction — a regatta that
  // started earlier today (and so is behind "now") should still count as
  // day 0, same fix as the home page's other "is this event still today"
  // checks.
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const eventDay = new Date(event.starts_at);
  eventDay.setHours(0, 0, 0, 0);
  const daysOut = Math.round((eventDay.getTime() - startOfToday.getTime()) / (24 * 60 * 60 * 1000));
  if (daysOut < 0 || daysOut > FORECAST_HORIZON_DAYS) return null;

  const { data: existingRow } = await supabase
    .from("event_forecasts")
    .select("*")
    .eq("event_id", event.id)
    .maybeSingle();
  const existing = existingRow as EventForecast | null;

  const locationChanged = existing?.geocoded_location !== event.location;
  const stale =
    !existing || locationChanged || Date.now() - new Date(existing.fetched_at).getTime() > CACHE_TTL_MS;
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
          { event_id: event.id, geocoded_location: event.location, fetched_at: new Date().toISOString() },
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
  const eventDateKey = localDateKey(event.starts_at);
  const dayPeriod = periods?.find((p) => localDateKey(p.startTime) === eventDateKey && p.isDaytime);
  const nightPeriod = periods?.find((p) => localDateKey(p.startTime) === eventDateKey && !p.isDaytime);
  const primary = dayPeriod ?? nightPeriod ?? null;

  const row = {
    event_id: event.id,
    geocoded_location: event.location,
    latitude: lat,
    longitude: lon,
    forecast_date: eventDateKey ? new Date(event.starts_at).toISOString().slice(0, 10) : null,
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
