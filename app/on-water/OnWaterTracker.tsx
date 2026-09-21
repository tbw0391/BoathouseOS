"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Lineup, OnWaterSession } from "@/lib/database.types";
import { startSession, endSession } from "./actions";

const PING_INTERVAL_MS = 7000;

export function OnWaterTracker({
  lineups,
  activeSession,
}: {
  lineups: Lineup[];
  activeSession: OnWaterSession | null;
}) {
  const [sessionId, setSessionId] = useState<string | null>(activeSession?.id ?? null);
  const [lineupId, setLineupId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [wakeLockSupported, setWakeLockSupported] = useState(true);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [startedAt, setStartedAt] = useState<Date | null>(
    activeSession ? new Date(activeSession.started_at) : null
  );
  const [elapsedMs, setElapsedMs] = useState(0);
  const [lastPingAt, setLastPingAt] = useState<Date | null>(null);
  const [lastAccuracy, setLastAccuracy] = useState<number | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const lastInsertRef = useRef<number>(0);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    setWakeLockSupported(typeof navigator !== "undefined" && "wakeLock" in navigator);
  }, []);

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
        const now = Date.now();
        if (now - lastInsertRef.current < PING_INTERVAL_MS) return;
        lastInsertRef.current = now;

        const { latitude, longitude, accuracy, heading, speed } = position.coords;
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
      (geoError) => setError(`Location error: ${geoError.message}`),
      { enableHighAccuracy: true, maximumAge: 5000 }
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
    setError(null);
    try {
      const id = await startSession(lineupId || null);
      setSessionId(id);
      setStartedAt(new Date());
      startWatch(id);
      await acquireWakeLock();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start tracking.");
    }
  }

  async function handleEnd() {
    if (!sessionId) return;
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    wakeLockRef.current?.release();
    setWakeLockActive(false);
    try {
      await endSession(sessionId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't end tracking.");
    }
    setSessionId(null);
    setStartedAt(null);
    setElapsedMs(0);
    setLastPingAt(null);
  }

  if (!sessionId) {
    return (
      <div className="flex flex-col gap-3 max-w-sm">
        {lineups.length > 0 && (
          <label className="flex flex-col gap-1 text-sm">
            Today&apos;s lineup (optional)
            <select
              value={lineupId}
              onChange={(e) => setLineupId(e.target.value)}
              className="border rounded px-3 py-2"
            >
              <option value="">No lineup — freeform outing</option>
              {lineups.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.boat_name}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          onClick={handleStart}
          className="bg-[#022e5d] text-white rounded-lg px-4 py-3 text-sm font-medium hover:bg-[#01213f] transition-colors"
        >
          Start Outing
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
      <div className="border-2 border-[#022e5d] rounded-lg p-4">
        <p className="text-sm text-gray-500">Tracking</p>
        <p className="text-2xl font-bold tabular-nums">
          {elapsedMin}:{String(elapsedSec).padStart(2, "0")}
        </p>
        <p className="text-sm text-gray-500 mt-2">
          {lastPingAgeSec === null
            ? "Waiting for first GPS fix…"
            : `Last ping ${lastPingAgeSec}s ago${lastAccuracy ? ` (±${Math.round(lastAccuracy)}m)` : ""}`}
        </p>
        {!wakeLockActive && (
          <p className="text-sm text-amber-600 mt-2">
            Keep this screen on and the app open — your phone may otherwise stop sending your location.
          </p>
        )}
      </div>
      <button
        onClick={handleEnd}
        className="bg-[#404040] text-white border-2 border-[#022e5d] rounded-lg px-4 py-3 text-sm font-medium hover:opacity-90 transition-opacity"
      >
        End Outing
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
