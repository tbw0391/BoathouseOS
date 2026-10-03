"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Truck } from "lucide-react";
import type { TrailerKindTracked } from "@/lib/database.types";
import { ARRIVING_ALERT_MINUTES, TRAILER_NAMES, milesLabel, minutesLabel } from "@/lib/trailerTracking";
import { unwrap } from "@/lib/userError";
import { endTrailerTrip, reportTrailerPosition, startTrailerTrip, type TrailerReport } from "./actions";

// Highway driving: a fix every 15 seconds is plenty and spares the battery.
const SEND_EVERY_MS = 15000;
const GPS_OPTIONS: PositionOptions = { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 };

export type TrailerOption = { eventId: string; eventTitle: string; trailer: TrailerKindTracked };

// The driver's phone: start tracking the trailer the day before the
// regatta, keep sending its position, stop on arrival.
export function TrailerTracker({
  options,
  activeTrip,
}: {
  options: TrailerOption[];
  activeTrip: { id: string; eventTitle: string; trailer: TrailerKindTracked; alerted: boolean } | null;
}) {
  const router = useRouter();
  const [trip, setTrip] = useState(activeTrip);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [report, setReport] = useState<TrailerReport | null>(null);
  const [lastSentAt, setLastSentAt] = useState<Date | null>(null);
  const [wakeLockOn, setWakeLockOn] = useState(false);
  const [, setTick] = useState(0);

  const watchRef = useRef<number | null>(null);
  const lastSendRef = useRef(0);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  async function keepScreenOn() {
    if (!("wakeLock" in navigator)) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request("screen");
      setWakeLockOn(true);
      wakeLockRef.current.addEventListener("release", () => setWakeLockOn(false));
    } catch {
      setWakeLockOn(false);
    }
  }

  function stopWatching() {
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
    wakeLockRef.current?.release();
    setWakeLockOn(false);
  }

  function watch(tripId: string) {
    if (!navigator.geolocation) {
      setError("This browser can't share its location. Use your phone.");
      return;
    }
    lastSendRef.current = 0;
    watchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        if (now - lastSendRef.current < SEND_EVERY_MS) return;
        lastSendRef.current = now;
        const { latitude, longitude, accuracy, speed, heading } = position.coords;
        reportTrailerPosition(tripId, {
          lat: latitude,
          lng: longitude,
          accuracyM: accuracy ?? null,
          speedMps: speed ?? null,
          headingDeg: heading ?? null,
        })
          .then((result) => {
            const r = unwrap(result);
            if (r.status === "ok") {
              setReport(r);
              setLastSentAt(new Date());
              setError(null);
              return;
            }
            stopWatching();
            setTrip(null);
            setNotice(
              r.status === "taken_over"
                ? "Another driver's phone is tracking this trailer now."
                : "Tracking has stopped (a coach stopped it, or the regatta has started)."
            );
            router.refresh();
          })
          .catch((e) => setError(e instanceof Error ? e.message : "Couldn't send your location."));
      },
      (geoError) => {
        if (geoError.code === geoError.PERMISSION_DENIED) {
          setError("Location is blocked for this app. Turn it on in your phone's settings, then reload this page.");
        } else if (geoError.code !== geoError.TIMEOUT) {
          setError(`Location error: ${geoError.message}`);
        }
      },
      GPS_OPTIONS
    );
  }

  useEffect(() => {
    if (activeTrip) {
      watch(activeTrip.id);
      keepScreenOn();
    }
    const tick = setInterval(() => setTick((t) => t + 1), 5000);
    function onVisible() {
      if (document.visibilityState === "visible" && watchRef.current !== null) keepScreenOn();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
      stopWatching();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start(option: TrailerOption) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const id = unwrap(await startTrailerTrip(option.eventId, option.trailer));
      setTrip({ id, eventTitle: option.eventTitle, trailer: option.trailer, alerted: false });
      setReport(null);
      watch(id);
      await keepScreenOn();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start tracking.");
    }
    setBusy(false);
  }

  async function stop() {
    if (!trip) return;
    setBusy(true);
    stopWatching();
    try {
      unwrap(await endTrailerTrip(trip.id));
      setTrip(null);
      setReport(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't stop tracking.");
    }
    setBusy(false);
  }

  if (!trip) {
    return (
      <div className="flex flex-col gap-3 max-w-sm">
        {notice && <p className="text-sm rounded-lg bg-amber-50 border border-amber-300 p-3">{notice}</p>}
        {options.map((o) => (
          <button
            key={`${o.eventId}-${o.trailer}`}
            onClick={() => start(o)}
            disabled={busy}
            className="flex items-center gap-3 bg-[var(--color-primary)] text-white rounded-lg px-4 py-3 text-sm font-medium text-left hover:bg-[var(--color-accent)] transition-colors disabled:opacity-50"
          >
            <Truck className="w-5 h-5 shrink-0" aria-hidden />
            <span>
              Start driving the {TRAILER_NAMES[o.trailer].toLowerCase()} to {o.eventTitle}
            </span>
          </button>
        ))}
        <p className="text-xs text-gray-500">
          Everyone can follow the trailer on the map while it&apos;s on the road. When you&apos;re about{" "}
          {ARRIVING_ALERT_MINUTES} minutes out, the club gets an alert to come help unload.
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  const ageSec = lastSentAt ? Math.floor((Date.now() - lastSentAt.getTime()) / 1000) : null;
  const alerted = trip.alerted || (report?.minutesAway != null && report.minutesAway <= ARRIVING_ALERT_MINUTES);

  return (
    <div className="flex flex-col gap-3 max-w-sm">
      <div className="border-2 border-[var(--color-primary)] rounded-lg p-4 flex flex-col gap-1">
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <Truck className="w-4 h-4" aria-hidden />
          Tracking the {TRAILER_NAMES[trip.trailer].toLowerCase()} to {trip.eventTitle}
        </p>
        {report?.minutesAway != null && report.metersAway != null ? (
          <p className="text-2xl font-bold">
            About {minutesLabel(report.minutesAway)} away
            <span className="block text-sm font-normal text-gray-500">{milesLabel(report.metersAway)} in a straight line</span>
          </p>
        ) : (
          <p className="text-lg font-semibold">{ageSec === null ? "Waiting for GPS…" : "On the road"}</p>
        )}
        {alerted && <p className="text-sm text-green-700">The club has been told to come help unload.</p>}
        <p className="text-sm text-gray-500">
          {ageSec === null ? "Getting your first location…" : `Location sent ${ageSec}s ago`}
        </p>
        {!wakeLockOn && (
          <p className="text-sm text-amber-600">
            Keep this app open on screen (a phone mount helps). Your phone may stop sending your location otherwise.
          </p>
        )}
      </div>
      <button
        onClick={stop}
        disabled={busy}
        className="bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] rounded-lg px-4 py-3 text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        We&apos;ve arrived — stop tracking
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
