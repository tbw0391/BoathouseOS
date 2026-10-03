"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Map as MapIcon, Navigation2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { LocationPing, OnWaterSession } from "@/lib/database.types";
import type { ActiveSessionView } from "@/lib/onWater";
import { endSession } from "@/app/on-water/actions";
import { unwrap } from "@/lib/userError";
import {
  ageLabel,
  boatColor,
  boatMotion,
  compass,
  distanceLabel,
  isApproximate,
  mph,
  split500,
  STALE_AFTER_MS,
} from "./boatDisplay";

const LeafletMap = dynamic(() => import("./LeafletMap"), { ssr: false });

// Coaches: every boat on the water right now, kept live over Supabase
// realtime, with a button that opens the map of where each one is.
export function LiveBoats({
  initialSessions,
  mapOpenByDefault = false,
  mapFirst = false,
  canEnd = false,
}: {
  initialSessions: ActiveSessionView[];
  mapOpenByDefault?: boolean;
  // The map, already open, above the list of boats (the On the Water tab).
  mapFirst?: boolean;
  // Coaches and admins can end any outing (a phone left tracking ashore).
  canEnd?: boolean;
}) {
  const [sessions, setSessions] = useState(initialSessions);
  const [confirmingEnd, setConfirmingEnd] = useState<string | null>(null);
  const [endError, setEndError] = useState<string | null>(null);

  async function endOuting(sessionId: string) {
    setConfirmingEnd(null);
    setEndError(null);
    try {
      unwrap(await endSession(sessionId));
      setSessions((prev) => prev.filter((view) => view.session.id !== sessionId));
    } catch (e) {
      setEndError(e instanceof Error ? e.message : "Couldn't end that outing.");
    }
  }
  const [showMap, setShowMap] = useState(mapOpenByDefault || mapFirst);
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  // Rowers and parents can't see an outing once it ends, so the realtime
  // "ended" update never reaches them. Recheck which boats are still out.
  useEffect(() => {
    const supabase = createClient();
    const id = setInterval(async () => {
      const { data, error } = await supabase.from("on_water_sessions").select("id").is("ended_at", null);
      if (error || !data) return;
      const stillOut = new Set((data as { id: string }[]).map((s) => s.id));
      setSessions((prev) => prev.filter((view) => stillOut.has(view.session.id)));
    }, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const channel = supabase
      .channel("live-boats")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "location_pings" },
        (payload) => {
          const ping = payload.new as LocationPing;
          setSessions((prev) =>
            prev.map((view) =>
              view.session.id === ping.session_id ? { ...view, prevPing: view.lastPing, lastPing: ping } : view
            )
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "on_water_sessions" },
        (payload) => {
          const updated = payload.new as OnWaterSession;
          if (updated.ended_at) {
            setSessions((prev) => prev.filter((view) => view.session.id !== updated.id));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "on_water_sessions" },
        async (payload) => {
          const inserted = payload.new as OnWaterSession;
          const [{ data: profile }, { data: boat }] = await Promise.all([
            supabase.from("profiles").select("display_name").eq("id", inserted.coxswain_id).single(),
            inserted.boat_id
              ? supabase.from("boats").select("name").eq("id", inserted.boat_id).single()
              : Promise.resolve({ data: null }),
          ]);
          if (cancelled) return;
          setSessions((prev) => [
            ...prev.filter((view) => view.session.id !== inserted.id),
            {
              session: inserted,
              coxswainName: (profile as { display_name: string } | null)?.display_name ?? "Unknown",
              boatName: (boat as { name: string } | null)?.name ?? null,
              lastPing: null,
              prevPing: null,
            },
          ]);
        }
      );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session) supabase.realtime.setAuth(session.access_token);
      channel.subscribe();
    });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  if (sessions.length === 0) {
    return <p className="text-sm text-gray-500">No boats are on the water right now.</p>;
  }

  const onMap = sessions.filter((v) => v.lastPing);

  const map = showMap &&
    (onMap.length === 0 ? (
      <p className="text-sm text-gray-500">No boat has a GPS fix yet, so there&apos;s nothing to map.</p>
    ) : (
      <LeafletMap sessions={onMap} />
    ));

  return (
    <div className="flex flex-col gap-3">
      {mapFirst && map}
      <ul className="flex flex-col gap-2">
        {sessions.map((view) => {
          const color = boatColor(view.session.color);
          const stale =
            view.lastPing && Date.now() - new Date(view.lastPing.recorded_at).getTime() > STALE_AFTER_MS;
          const motion = boatMotion(view.lastPing, view.prevPing);
          return (
            <li
              key={view.session.id}
              className="flex items-center gap-3 rounded-lg border-2 px-4 py-3"
              style={{ borderColor: color }}
            >
              <span className="w-5 h-5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-bold truncate">{view.boatName ?? "Boat not set"}</p>
                <p className="text-sm text-gray-600 truncate">
                  {view.coxswainName} · out since{" "}
                  {new Date(view.session.started_at).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
                {view.lastPing && isApproximate(view.lastPing.accuracy_m) && (
                  <p className="text-sm text-amber-700 mt-0.5">
                    Rough location only (±{distanceLabel(view.lastPing.accuracy_m!)}). The cox&apos;s phone needs
                    Precise Location turned on.
                  </p>
                )}
                {view.lastPing && !stale && motion.speedMps != null && (
                  <p className="flex items-center gap-1.5 text-sm font-medium mt-0.5">
                    {motion.moving ? (
                      <>
                        <span className="tabular-nums">{split500(motion.speedMps)} /500m</span>
                        <span className="text-gray-500 tabular-nums">({mph(motion.speedMps)} mph)</span>
                        {motion.headingDeg != null && (
                          <>
                            <Navigation2
                              className="w-4 h-4 shrink-0"
                              style={{ transform: `rotate(${Math.round(motion.headingDeg)}deg)`, color }}
                              aria-hidden
                            />
                            <span>heading {compass(motion.headingDeg)}</span>
                          </>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-500">Stopped</span>
                    )}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={`text-xs ${stale ? "text-red-600" : "text-gray-500"}`}>
                  {view.lastPing
                    ? stale
                      ? `No GPS for ${ageLabel(view.lastPing.recorded_at)}`
                      : `GPS ${ageLabel(view.lastPing.recorded_at)} ago`
                    : "Waiting for GPS…"}
                </span>
                {canEnd &&
                  (confirmingEnd === view.session.id ? (
                    <span className="flex gap-2 text-xs">
                      <button onClick={() => endOuting(view.session.id)} className="font-semibold text-red-700 underline">
                        Yes, end
                      </button>
                      <button onClick={() => setConfirmingEnd(null)} className="text-gray-600 underline">
                        Keep
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmingEnd(view.session.id)}
                      className="text-xs text-gray-600 underline"
                    >
                      End
                    </button>
                  ))}
              </div>
            </li>
          );
        })}
      </ul>

      {endError && <p className="text-sm text-red-600">{endError}</p>}

      {!mapFirst && (
        <>
          <button
            onClick={() => setShowMap((s) => !s)}
            className="flex items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] text-white px-4 py-3 font-medium hover:bg-[var(--color-accent)] transition-colors"
          >
            <MapIcon className="w-5 h-5" aria-hidden />
            {showMap ? "Hide map" : "Show map"}
          </button>
          {map}
        </>
      )}
    </div>
  );
}
