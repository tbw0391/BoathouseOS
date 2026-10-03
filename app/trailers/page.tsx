import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, TrailerKindTracked } from "@/lib/database.types";
import { AutoRefresh } from "@/components/AutoRefresh";
import { trailerRegattas } from "@/lib/trailerTrips";
import {
  TRAILER_NAMES,
  driveMinutes,
  isDayBefore,
  MAX_USABLE_ACCURACY_M,
  metersBetween,
  milesLabel,
  minutesLabel,
} from "@/lib/trailerTracking";
import { TrailerTracker, type TrailerOption } from "./TrailerTracker";
import { TrailerBoard, type RegattaRow } from "./TrailerBoard";

const TRAILER_COLORS: Record<TrailerKindTracked, string> = { boat: "#2563eb", food: "#ea580c" };

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });

function agoLabel(iso: string) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  return min < 1 ? "just now" : `${min} min ago`;
}

export default async function TrailersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: meData }, regattas] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, role, is_boat_trailer_driver, is_food_trailer_driver")
      .eq("id", user.id)
      .single(),
    trailerRegattas(supabase),
  ]);
  const me = meData as Pick<Profile, "id" | "role" | "is_boat_trailer_driver" | "is_food_trailer_driver"> | null;
  const myTrailers: TrailerKindTracked[] = [
    ...(me?.is_boat_trailer_driver ? (["boat"] as const) : []),
    ...(me?.is_food_trailer_driver ? (["food"] as const) : []),
  ];
  const canStop = me?.role === "coach" || me?.role === "admin";

  // What this driver can start: each of their trailers to each of
  // tomorrow's regattas (the food trailer only where there's a food tent).
  const options: TrailerOption[] = regattas
    .filter((r) => isDayBefore(r.event.starts_at))
    .flatMap((r) =>
      myTrailers
        .filter((t) => t === "boat" || r.event.has_food_tent)
        .map((trailer) => ({ eventId: r.event.id, eventTitle: r.event.title, trailer }))
    );
  const mine = regattas
    .flatMap((r) => r.trips.map((t) => ({ trip: t, title: r.event.title })))
    .find(({ trip }) => !trip.ended_at && trip.driver_id === user.id);

  const rows: RegattaRow[] = regattas.map(({ event, site, trips }) => ({
    eventId: event.id,
    title: event.title,
    when: new Date(event.starts_at).toLocaleString("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
    site: site ? { ...site, label: event.title } : null,
    trailers: trips.map((t) => {
      const label = TRAILER_NAMES[t.trailer];
      const onRoad = !t.ended_at;
      const located = t.lat != null && t.lng != null && t.located_at;
      let status: string;
      if (!onRoad) {
        status = `Stopped tracking at ${timeLabel(t.ended_at!)}${t.arriving_alert_at ? " (arrived)" : ""}`;
      } else if (!located) {
        status = `${t.driverName ?? "Driver"} is on the road · waiting for GPS`;
      } else {
        const here = { lat: t.lat!, lng: t.lng! };
        const usable = site && (t.accuracy_m == null || t.accuracy_m <= MAX_USABLE_ACCURACY_M);
        const away = usable
          ? `about ${minutesLabel(driveMinutes(here, site))} away (${milesLabel(metersBetween(here, site))})`
          : "on the road";
        status = `${t.driverName ?? "Driver"} · ${away} · updated ${agoLabel(t.located_at!)}${
          t.arriving_alert_at ? " · unload alert sent" : ""
        }`;
      }
      return {
        tripId: t.id,
        label,
        status,
        onRoad,
        pin: located
          ? {
              id: t.id,
              lat: t.lat!,
              lng: t.lng!,
              label,
              detail: `${t.driverName ?? "Driver"} · updated ${agoLabel(t.located_at!)}`,
              color: TRAILER_COLORS[t.trailer],
            }
          : null,
      };
    }),
  }));

  return (
    <div className="min-h-screen p-8 flex flex-col gap-6">
      <AutoRefresh seconds={20} />
      <h1 className="text-2xl font-bold">Trailers</h1>

      {myTrailers.length > 0 && (mine || options.length > 0) && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Your trailer</h2>
          <TrailerTracker
            options={options}
            activeTrip={
              mine
                ? {
                    id: mine.trip.id,
                    eventTitle: mine.title,
                    trailer: mine.trip.trailer,
                    alerted: Boolean(mine.trip.arriving_alert_at),
                  }
                : null
            }
          />
        </section>
      )}

      {rows.length > 0 ? (
        <TrailerBoard regattas={rows} canStop={canStop} />
      ) : (
        <p className="text-sm text-gray-600 max-w-md">
          Trailer tracking turns on the day before a regatta. The boat and food trailer drivers start it from this
          page, and you&apos;ll be able to follow them here. When a trailer is about 30 minutes out, everyone gets an
          alert to come help unload.
          {me?.role === "admin" && (
            <>
              {" "}
              Admins name the drivers on each member&apos;s{" "}
              <Link href="/roster" className="underline">
                profile
              </Link>
              .
            </>
          )}
        </p>
      )}
    </div>
  );
}
