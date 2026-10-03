import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventForecast, ScheduleEvent, TrailerTrip } from "@/lib/database.types";
import { getOrRefreshEventForecast } from "@/lib/weather";
import { isDayBefore, type LatLng } from "@/lib/trailerTracking";

// Where the trailers are headed: the finish line set on the regatta's
// Course tab, else the start, else the event's location looked up for the
// weather forecast. Null if none of those are set.
export async function regattaSite(supabase: SupabaseClient, event: ScheduleEvent): Promise<LatLng | null> {
  if (event.finish_lat != null && event.finish_lng != null) return { lat: event.finish_lat, lng: event.finish_lng };
  if (event.start_lat != null && event.start_lng != null) return { lat: event.start_lat, lng: event.start_lng };
  if (!event.location) return null;

  const { data } = await supabase
    .from("event_forecasts")
    .select("latitude, longitude, geocoded_location")
    .eq("event_id", event.id)
    .maybeSingle();
  let cached = data as Pick<EventForecast, "latitude" | "longitude" | "geocoded_location"> | null;
  if (!cached || cached.geocoded_location !== event.location || cached.latitude == null) {
    cached = await getOrRefreshEventForecast(supabase, event).catch(() => null);
  }
  return cached?.latitude != null && cached.longitude != null ? { lat: cached.latitude, lng: cached.longitude } : null;
}

export interface TrailerRegatta {
  event: ScheduleEvent;
  site: LatLng | null;
  // Latest trip per trailer (open or not), with the driver's name.
  trips: (TrailerTrip & { driverName: string | null })[];
}

// Regattas the trailers could be on the way to right now: tomorrow's, plus
// any not yet started with a trailer still on the road (just after midnight).
export async function trailerRegattas(supabase: SupabaseClient): Promise<TrailerRegatta[]> {
  const now = new Date();
  const { data: eventsData } = await supabase
    .from("schedule_events")
    .select("*")
    .eq("event_type", "regatta")
    .gt("starts_at", now.toISOString())
    .lt("starts_at", new Date(now.getTime() + 48 * 3600 * 1000).toISOString())
    .order("starts_at");
  const upcoming = (eventsData as ScheduleEvent[] | null) ?? [];
  if (upcoming.length === 0) return [];

  const { data: tripsData } = await supabase
    .from("trailer_trips")
    .select("*")
    .in(
      "event_id",
      upcoming.map((e) => e.id)
    )
    .order("started_at", { ascending: false });
  const trips = (tripsData as TrailerTrip[] | null) ?? [];

  const events = upcoming.filter(
    (e) => isDayBefore(e.starts_at, now) || trips.some((t) => t.event_id === e.id && !t.ended_at)
  );
  if (events.length === 0) return [];

  const driverIds = [...new Set(trips.map((t) => t.driver_id).filter((id): id is string => Boolean(id)))];
  const { data: driversData } = driverIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", driverIds)
    : { data: [] };
  const nameById = new Map(
    ((driversData as { id: string; display_name: string }[] | null) ?? []).map((p) => [p.id, p.display_name])
  );

  return Promise.all(
    events.map(async (event) => {
      const latest = new Map<string, TrailerTrip>();
      for (const t of trips) {
        if (t.event_id === event.id && !latest.has(t.trailer)) latest.set(t.trailer, t);
      }
      return {
        event,
        site: await regattaSite(supabase, event),
        trips: [...latest.values()].map((t) => ({
          ...t,
          driverName: t.driver_id ? (nameById.get(t.driver_id) ?? null) : null,
        })),
      };
    })
  );
}
