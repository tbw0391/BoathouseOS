"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { activeMemberIds, sendPush } from "@/lib/push";
import type { ScheduleEvent, TrailerKindTracked, TrailerTrip } from "@/lib/database.types";
import { regattaSite } from "@/lib/trailerTrips";
import {
  ARRIVING_ALERT_MINUTES,
  TRAILER_NAMES,
  TRACKED_TRAILERS,
  driveMinutes,
  isArriving,
  metersBetween,
  MAX_USABLE_ACCURACY_M,
} from "@/lib/trailerTracking";
import { UserError, tryAction } from "@/lib/userError";

export async function startTrailerTrip(eventId: string, trailer: TrailerKindTracked) {
  return tryAction(async () => {
    if (!TRACKED_TRAILERS.includes(trailer)) throw new UserError("Pick a trailer.");
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("start_trailer_trip", { p_event: eventId, p_trailer: trailer });
    if (error) throw new UserError(error.message);
    revalidatePath("/trailers");
    revalidatePath("/");
    return data as string;
  });
}

export async function endTrailerTrip(tripId: string) {
  return tryAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase.rpc("end_trailer_trip", { p_trip: tripId });
    if (error) throw new UserError(error.message);
    revalidatePath("/trailers");
    revalidatePath("/");
  });
}

export type TrailerFix = {
  lat: number;
  lng: number;
  accuracyM: number | null;
  speedMps: number | null;
  headingDeg: number | null;
};

export type TrailerReport = {
  status: "ok" | "ended" | "taken_over";
  // How far from the regatta, when it's known.
  metersAway: number | null;
  minutesAway: number | null;
};

// A GPS fix from the driver's phone. Once the trailer is about 30 minutes
// from the regatta, everyone in the club is asked to come help unload
// (once per trailer per regatta).
export async function reportTrailerPosition(tripId: string, fix: TrailerFix) {
  return tryAction(async (): Promise<TrailerReport> => {
    const supabase = await createClient();
    const { data: status, error } = await supabase.rpc("update_trailer_position", {
      p_trip: tripId,
      p_lat: fix.lat,
      p_lng: fix.lng,
      p_accuracy_m: fix.accuracyM,
      p_speed_mps: fix.speedMps,
      p_heading_deg: fix.headingDeg,
    });
    if (error) throw new UserError(error.message);
    if (status !== "ok") return { status: status as TrailerReport["status"], metersAway: null, minutesAway: null };

    const { data: tripData } = await supabase
      .from("trailer_trips")
      .select("*, schedule_events(*)")
      .eq("id", tripId)
      .single();
    const trip = tripData as (TrailerTrip & { schedule_events: ScheduleEvent | null }) | null;
    const event = trip?.schedule_events;
    if (!trip || !event) return { status: "ok", metersAway: null, minutesAway: null };

    const site = await regattaSite(supabase, event);
    if (!site) return { status: "ok", metersAway: null, minutesAway: null };

    const here = { lat: fix.lat, lng: fix.lng };
    const usable = fix.accuracyM == null || fix.accuracyM <= MAX_USABLE_ACCURACY_M;
    if (!trip.arriving_alert_at && isArriving(here, site, fix.accuracyM)) {
      after(() => alertArriving(trip, event));
    }
    return {
      status: "ok",
      metersAway: usable ? metersBetween(here, site) : null,
      minutesAway: usable ? driveMinutes(here, site) : null,
    };
  });
}

async function alertArriving(trip: TrailerTrip, event: ScheduleEvent) {
  const admin = createAdminClient();

  // Once per trailer per regatta, even if tracking was stopped and restarted.
  const { count } = await admin
    .from("trailer_trips")
    .select("id", { count: "exact", head: true })
    .eq("event_id", trip.event_id)
    .eq("trailer", trip.trailer)
    .not("arriving_alert_at", "is", null);
  if ((count ?? 0) > 0) return;
  const { data: claimed } = await admin
    .from("trailer_trips")
    .update({ arriving_alert_at: new Date().toISOString() })
    .eq("id", trip.id)
    .is("arriving_alert_at", null)
    .select("id");
  if (!claimed || claimed.length === 0) return;

  const arrives = new Date(Date.now() + ARRIVING_ALERT_MINUTES * 60 * 1000).toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  });
  const name = TRAILER_NAMES[trip.trailer];
  // Not the driver: they're driving.
  const everyone = (await activeMemberIds(trip.club_id)).filter((id) => id !== trip.driver_id);
  await sendPush(everyone, {
    kind: "trailer_arriving",
    title: `🚚 ${name} is about ${ARRIVING_ALERT_MINUTES} minutes out`,
    body: `Arriving at ${event.title} around ${arrives}. Come help unload!`,
    url: "/trailers",
    tag: `trailer-${trip.event_id}-${trip.trailer}`,
  });
}
