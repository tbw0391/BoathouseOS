"use client";

import { useEffect, useRef, useState } from "react";
import { metersPerStroke, rateFromTaps, speedFromFixes, TAP_GAP_RESET_MS } from "@/lib/strokeRate";
import { mph, split500 } from "@/app/coach/tracking/boatDisplay";
import { unwrap } from "@/lib/userError";
import { addCoachNote } from "@/app/coach/notes/actions";

type Fix = { lat: number; lng: number; at: number; speedMps: number | null; accuracyM: number | null };

const GPS_OPTIONS: PositionOptions = { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 };
// Below about 1 knot the launch is drifting, not following a crew.
const MOVING_MPS = 0.5;

export function RateClicker({ boats, today }: { boats: { id: string; name: string }[]; today: string }) {
  const [taps, setTaps] = useState<number[]>([]);
  const [fixes, setFixes] = useState<Fix[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [boatName, setBoatName] = useState<string | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // GPS and screen-on for as long as the page is open.
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsError("This browser can't read GPS, so there's no split. Rate still works.");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setGpsError(null);
        const fix: Fix = {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          at: p.timestamp,
          speedMps: p.coords.speed,
          accuracyM: p.coords.accuracy ?? null,
        };
        setFixes((prev) => [...prev.filter((f) => fix.at - f.at <= 30000), fix]);
      },
      (e) => {
        if (e.code === e.PERMISSION_DENIED) setGpsError("Location is blocked, so there's no split. Rate still works.");
      },
      GPS_OPTIONS
    );
    const lock = () =>
      navigator.wakeLock
        ?.request("screen")
        .then((l) => (wakeLockRef.current = l))
        .catch(() => {});
    lock();
    const onVisible = () => document.visibilityState === "visible" && lock();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      navigator.geolocation.clearWatch(id);
      document.removeEventListener("visibilitychange", onVisible);
      wakeLockRef.current?.release();
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  function tap() {
    const t = Date.now();
    setNow(t);
    setTaps((prev) => [...prev.slice(-20), t]);
    navigator.vibrate?.(15);
  }

  const lastTap = taps[taps.length - 1];
  const paused = lastTap == null || now - lastTap > TAP_GAP_RESET_MS;
  const rate = paused ? null : rateFromTaps(taps);
  const speed = speedFromFixes(fixes, now);
  const moving = speed != null && speed >= MOVING_MPS;
  const perStroke = rate != null && moving ? metersPerStroke(speed, rate) : null;
  const split = moving ? split500(speed) : null;

  const reading = [
    rate != null ? `${Math.round(rate)} spm` : null,
    split ? `${split} /500m` : null,
    perStroke != null ? `${perStroke.toFixed(1)} m/stroke` : null,
  ].filter(Boolean);

  async function saveReading() {
    if (reading.length === 0) return;
    setSaving(true);
    setSaveError(null);
    const line = `${boatName ? `${boatName}: ` : ""}${reading.join(" · ")} (Rate & Split)`;
    try {
      unwrap(await addCoachNote({ athleteId: null, noteDate: today, body: line }));
      setSaved((prev) => [
        `${new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} ${line}`,
        ...prev,
      ]);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Couldn't save that reading.");
    }
    setSaving(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Rate" value={rate != null ? String(Math.round(rate)) : "—"} unit="spm" />
        <Stat label="Split" value={split ?? "—"} unit="/500m" />
        <Stat label="Per stroke" value={perStroke != null ? perStroke.toFixed(1) : "—"} unit="m" />
      </div>
      <p className="text-center text-xs text-gray-500">
        {speed != null ? `${mph(speed)} mph` : "Waiting for GPS…"}
        {paused && taps.length > 0 && " · tap at the next catch to start again"}
      </p>
      {gpsError && <p className="text-sm text-amber-700">{gpsError}</p>}

      <button
        type="button"
        onPointerDown={tap}
        className="h-64 rounded-2xl bg-[var(--color-primary)] text-white text-2xl font-bold active:bg-[var(--color-accent)] select-none"
        style={{ touchAction: "manipulation" }}
      >
        Tap at each catch
      </button>

      {boats.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Which boat? (for saved readings)</p>
          <div className="flex flex-wrap gap-2">
            {boats.map((b) => (
              <button
                key={b.id}
                type="button"
                aria-pressed={boatName === b.name}
                onClick={() => setBoatName(boatName === b.name ? null : b.name)}
                className={`rounded-lg border-2 px-3 py-1.5 text-sm ${
                  boatName === b.name
                    ? "border-[var(--color-primary)] bg-[var(--color-secondary)] text-white"
                    : "border-gray-300"
                }`}
              >
                {b.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={saveReading}
        disabled={saving || reading.length === 0}
        className="rounded-lg border-2 border-[var(--color-primary)] px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save reading to today's practice notes"}
      </button>
      {saveError && <p className="text-sm text-red-600">{saveError}</p>}
      {saved.length > 0 && (
        <ul className="text-sm text-gray-600 flex flex-col gap-1">
          {saved.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      )}
      <p className="text-xs text-gray-500">
        The split is the launch&apos;s speed, so it&apos;s only right while you&apos;re keeping pace alongside the crew.
      </p>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-lg border-2 border-gray-200 px-2 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-3xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-gray-500">{unit}</p>
    </div>
  );
}
