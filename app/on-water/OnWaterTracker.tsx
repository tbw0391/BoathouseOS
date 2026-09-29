"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Boat, OnWaterSession } from "@/lib/database.types";
import { ON_WATER_COLORS } from "@/lib/onWaterColors";
import { startSession, endSession } from "./actions";
import { APPROXIMATE_FIX_M, distanceLabel, GOOD_FIX_M } from "@/app/coach/tracking/boatDisplay";
import { unwrap } from "@/lib/userError";

const PING_INTERVAL_MS = 7000;

// Always a fresh fix from the GPS chip, never a cached or network guess.
const GPS_OPTIONS: PositionOptions = { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 };

// Green / amber / red line under the timer, plus how to fix a blurry fix.
function GpsQuality({ accuracyM }: { accuracyM: number | null }) {
  if (accuracyM == null) return null;
  if (accuracyM <= GOOD_FIX_M) {
    return <p className="text-sm text-green-700 mt-2">Strong GPS (±{distanceLabel(accuracyM)})</p>;
  }
  if (accuracyM <= APPROXIMATE_FIX_M) {
    return (
      <p className="text-sm text-amber-600 mt-2">
        Weak GPS (±{distanceLabel(accuracyM)}). It usually sharpens after a minute outdoors with a clear view of the
        sky.
      </p>
    );
  }
  return (
    <div className="text-sm text-red-700 mt-2 rounded-lg border-2 border-red-600 bg-red-50 p-3 flex flex-col gap-1">
      <p className="font-bold">Your phone is only sending a rough location (±{distanceLabel(accuracyM)}).</p>
      <p>
        <strong>iPhone:</strong> Settings → Privacy &amp; Security → Location Services → Safari Websites (or the
        browser you use) → turn on <strong>Precise Location</strong>, then reload this page.
      </p>
      <p>
        <strong>Android:</strong> Settings → Location → turn on <strong>Google Location Accuracy</strong> and make
        sure this browser&apos;s location permission has <strong>Precise</strong> selected.
      </p>
      <p>A laptop has no GPS, so use a phone on the water.</p>
    </div>
  );
}

// This phone remembers which boat it's in and its color, so the coxswain
// only has to pick them once.
const BOAT_KEY = "onWater.boatId";
const COLOR_KEY = "onWater.color";

function readSaved(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function LocationSwitch({ permission, onEnable }: { permission: PermissionState; onEnable: () => void }) {
  const isOn = permission === "granted";
  const isDenied = permission === "denied";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">GPS location</span>
        <button
          type="button"
          role="switch"
          aria-checked={isOn}
          onClick={onEnable}
          disabled={isOn || isDenied}
          className={`relative w-11 h-6 rounded-full transition-colors disabled:cursor-default ${
            isOn ? "bg-[var(--color-primary)]" : "bg-gray-300"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
              isOn ? "translate-x-5" : ""
            }`}
          />
        </button>
      </div>
      {isDenied && (
        <p className="text-xs text-amber-600">
          Location is blocked for this app. Enable it in your phone&apos;s Settings (Safari/Chrome
          → Location, or tap the site info icon in the address bar), then reload this page.
        </p>
      )}
      {!isOn && !isDenied && <p className="text-xs text-gray-500">Tap the switch to allow location access.</p>}
    </div>
  );
}

export function OnWaterTracker({
  boats,
  suggestedBoatId,
  colorsInUse,
  activeSession,
}: {
  boats: Pick<Boat, "id" | "name">[];
  suggestedBoatId: string | null;
  colorsInUse: string[];
  activeSession: OnWaterSession | null;
}) {
  const [sessionId, setSessionId] = useState<string | null>(activeSession?.id ?? null);
  const [boatId, setBoatId] = useState<string | null>(activeSession?.boat_id ?? suggestedBoatId);
  const [pickingBoat, setPickingBoat] = useState(false);
  const [color, setColor] = useState<string | null>(activeSession?.color ?? null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wakeLockSupported, setWakeLockSupported] = useState(true);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [startedAt, setStartedAt] = useState<Date | null>(
    activeSession ? new Date(activeSession.started_at) : null
  );
  const [elapsedMs, setElapsedMs] = useState(0);
  const [lastPingAt, setLastPingAt] = useState<Date | null>(null);
  const [lastAccuracy, setLastAccuracy] = useState<number | null>(null);
  const [permission, setPermission] = useState<PermissionState>("prompt");

  const watchIdRef = useRef<number | null>(null);
  const lastInsertRef = useRef<number>(0);
  // The most accurate fix seen since the last one sent.
  const bestFixRef = useRef<GeolocationPosition | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    setWakeLockSupported(typeof navigator !== "undefined" && "wakeLock" in navigator);
  }, []);

  useEffect(() => {
    if (activeSession) return;
    const savedBoat = readSaved(BOAT_KEY);
    if (!suggestedBoatId && savedBoat && boats.some((b) => b.id === savedBoat)) setBoatId(savedBoat);
    const savedColor = readSaved(COLOR_KEY);
    const free = ON_WATER_COLORS.filter((c) => !colorsInUse.includes(c.hex));
    setColor(
      savedColor && free.some((c) => c.hex === savedColor) ? savedColor : (free[0]?.hex ?? ON_WATER_COLORS[0].hex)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reflects the browser's real geolocation permission — once denied, no
  // amount of in-app UI can force the prompt back; that decision only
  // changes via the browser/OS's own site-settings, which this listens for.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) return;
    let status: PermissionStatus | null = null;
    navigator.permissions
      .query({ name: "geolocation" })
      .then((result) => {
        status = result;
        setPermission(result.state);
        result.onchange = () => setPermission(result.state);
      })
      .catch(() => {});
    return () => {
      if (status) status.onchange = null;
    };
  }, []);

  function requestLocation() {
    if (!navigator.geolocation) {
      setError("This browser doesn't support location tracking.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPermission("granted");
        setLastAccuracy(position.coords.accuracy ?? null);
      },
      (geoError) => {
        if (geoError.code === geoError.PERMISSION_DENIED) {
          setPermission("denied");
        } else {
          setError(`Location error: ${geoError.message}`);
        }
      },
      GPS_OPTIONS
    );
  }

  // Before an outing, take a reading so the coxswain sees GPS quality up front.
  useEffect(() => {
    if (permission !== "granted" || sessionId || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => setLastAccuracy(position.coords.accuracy ?? null),
      () => {},
      GPS_OPTIONS
    );
  }, [permission, sessionId]);

  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setElapsedMs(Date.now() - startedAt.getTime()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  async function acquireWakeLock() {
    if (!wakeLockSupported) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request("screen");
      setWakeLockActive(true);
      wakeLockRef.current.addEventListener("release", () => setWakeLockActive(false));
    } catch {
      setWakeLockActive(false);
    }
  }

  useEffect(() => {
    if (!sessionId) return;

    function onVisibilityChange() {
      if (document.visibilityState === "visible" && sessionId) {
        acquireWakeLock();
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  function startWatch(activeSessionId: string) {
    if (!navigator.geolocation) {
      setError("This browser doesn't support location tracking.");
      return;
    }
    const supabase = createClient();

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const best = bestFixRef.current;
        if (!best || position.coords.accuracy <= best.coords.accuracy) bestFixRef.current = position;

        const now = Date.now();
        if (now - lastInsertRef.current < PING_INTERVAL_MS) return;
        lastInsertRef.current = now;

        const fix = bestFixRef.current ?? position;
        bestFixRef.current = null;
        const { latitude, longitude, accuracy, heading, speed } = fix.coords;
        supabase
          .from("location_pings")
          .insert({
            session_id: activeSessionId,
            lat: latitude,
            lng: longitude,
            accuracy_m: accuracy ?? null,
            heading_deg: heading ?? null,
            speed_mps: speed ?? null,
          })
          .then(({ error: insertError }) => {
            if (insertError) {
              setError(insertError.message);
            } else {
              setLastPingAt(new Date());
              setLastAccuracy(accuracy ?? null);
              setError(null);
            }
          });
      },
      (geoError) => {
        // A timeout just means no new fix yet; watchPosition keeps trying.
        if (geoError.code !== geoError.TIMEOUT) setError(`Location error: ${geoError.message}`);
      },
      GPS_OPTIONS
    );
  }

  useEffect(() => {
    if (activeSession) {
      startWatch(activeSession.id);
      acquireWakeLock();
    }
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      wakeLockRef.current?.release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleStart() {
    if (!boatId || !color) return;
    setError(null);
    setStarting(true);
    try {
      const id = unwrap(await startSession(boatId, color));
      save(BOAT_KEY, boatId);
      save(COLOR_KEY, color);
      setSessionId(id);
      setStartedAt(new Date());
      startWatch(id);
      await acquireWakeLock();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start tracking.");
    }
    setStarting(false);
  }

  async function handleEnd() {
    if (!sessionId) return;
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    wakeLockRef.current?.release();
    setWakeLockActive(false);
    try {
      unwrap(await endSession(sessionId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't end tracking.");
    }
    setSessionId(null);
    setStartedAt(null);
    setElapsedMs(0);
    setLastPingAt(null);
  }

  const boatName = boats.find((b) => b.id === boatId)?.name ?? null;
  const colorName = ON_WATER_COLORS.find((c) => c.hex === color)?.name ?? null;

  if (!sessionId) {
    return (
      <div className="flex flex-col gap-5 max-w-sm">
        <div>
          <LocationSwitch permission={permission} onEnable={requestLocation} />
          <GpsQuality accuracyM={lastAccuracy} />
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Which boat is this phone in?</p>
          {boatName && !pickingBoat ? (
            <div className="flex items-center justify-between rounded-lg border-2 border-[var(--color-primary)] px-4 py-3">
              <span className="font-bold">{boatName}</span>
              <button onClick={() => setPickingBoat(true)} className="text-sm underline text-gray-600">
                Change
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {boats.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  aria-pressed={b.id === boatId}
                  onClick={() => {
                    setBoatId(b.id);
                    setPickingBoat(false);
                  }}
                  className={`rounded-lg border-2 px-3 py-3 text-sm font-medium ${
                    b.id === boatId
                      ? "border-[var(--color-primary)] bg-[var(--color-secondary)] text-white"
                      : "border-gray-300 hover:border-[var(--color-primary)]"
                  }`}
                >
                  {b.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Your color on the coaches&apos; map{colorName ? `: ${colorName}` : ""}
          </p>
          <div className="grid grid-cols-5 gap-2">
            {ON_WATER_COLORS.map((c) => {
              const taken = colorsInUse.includes(c.hex);
              const selected = c.hex === color;
              return (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setColor(c.hex)}
                  disabled={taken}
                  aria-pressed={selected}
                  aria-label={taken ? `${c.name} (another boat has it)` : c.name}
                  title={taken ? `${c.name} — another boat on the water has it` : c.name}
                  className={`relative aspect-square rounded-full disabled:opacity-25 disabled:cursor-not-allowed ${
                    selected ? "ring-4 ring-offset-2 ring-[var(--color-primary)]" : ""
                  }`}
                  style={{ backgroundColor: c.hex }}
                >
                  {taken && (
                    <span className="absolute inset-0 flex items-center justify-center text-white text-lg font-bold">
                      ✕
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={handleStart}
          disabled={permission === "denied" || !boatId || !color || starting}
          className="bg-[var(--color-primary)] text-white rounded-lg px-4 py-3 text-sm font-medium hover:bg-[var(--color-accent)] transition-colors disabled:opacity-50"
        >
          {starting ? "Starting..." : !boatId ? "Pick your boat to start" : "Start Outing"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  const elapsedMin = Math.floor(elapsedMs / 60000);
  const elapsedSec = Math.floor((elapsedMs % 60000) / 1000);
  const lastPingAgeSec = lastPingAt ? Math.floor((Date.now() - lastPingAt.getTime()) / 1000) : null;

  return (
    <div className="flex flex-col gap-3 max-w-sm">
      <div className="border-2 rounded-lg p-4" style={{ borderColor: color ?? undefined }}>
        <p className="flex items-center gap-2 text-sm text-gray-500">
          {color && <span className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} aria-hidden />}
          Tracking{boatName ? ` ${boatName}` : ""}
        </p>
        <p className="text-2xl font-bold tabular-nums">
          {elapsedMin}:{String(elapsedSec).padStart(2, "0")}
        </p>
        <p className="text-sm text-gray-500 mt-2">
          {lastPingAgeSec === null
            ? "Waiting for first GPS fix…"
            : `Last ping ${lastPingAgeSec}s ago`}
        </p>
        <GpsQuality accuracyM={lastAccuracy} />
        {!wakeLockActive && (
          <p className="text-sm text-amber-600 mt-2">
            Keep this screen on and the app open — your phone may otherwise stop sending your location.
          </p>
        )}
      </div>
      <button
        onClick={handleEnd}
        className="bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] rounded-lg px-4 py-3 text-sm font-medium hover:opacity-90 transition-opacity"
      >
        End Outing
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
