"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Map as MapIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { LocationPing, OnWaterSession } from "@/lib/database.types";
import type { ActiveSessionView } from "@/lib/onWater";
import { ageLabel, boatColor, STALE_AFTER_MS } from "./boatDisplay";

const LeafletMap = dynamic(() => import("./LeafletMap"), { ssr: false });

// Coaches: every boat on the water right now, kept live over Supabase
// realtime, with a button that opens the map of where each one is.
export function LiveBoats({
  initialSessions,
  mapOpenByDefault = false,
}: {
  initialSessions: ActiveSessionView[];
  mapOpenByDefault?: boolean;
}) {
  const [sessions, setSessions] = useState(initialSessions);
  const [showMap, setShowMap] = useState(mapOpenByDefault);
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5000);
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
            prev.map((view) => (view.session.id === ping.session_id ? { ...view, lastPing: ping } : view))
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

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {sessions.map((view) => {
          const color = boatColor(view.session.color);
          const stale =
            view.lastPing && Date.now() - new Date(view.lastPing.recorded_at).getTime() > STALE_AFTER_MS;
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
              </div>
              <span className={`text-xs shrink-0 ${stale ? "text-red-600" : "text-gray-500"}`}>
                {view.lastPing
                  ? stale
                    ? `No GPS for ${ageLabel(view.lastPing.recorded_at)}`
                    : `GPS ${ageLabel(view.lastPing.recorded_at)} ago`
                  : "Waiting for GPS…"}
              </span>
            </li>
          );
        })}
      </ul>

      <button
        onClick={() => setShowMap((s) => !s)}
        className="flex items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] text-white px-4 py-3 font-medium hover:bg-[var(--color-accent)] transition-colors"
      >
        <MapIcon className="w-5 h-5" aria-hidden />
        {showMap ? "Hide map" : "Show map"}
      </button>

      {showMap &&
        (onMap.length === 0 ? (
          <p className="text-sm text-gray-500">No boat has a GPS fix yet, so there&apos;s nothing to map.</p>
        ) : (
          <LeafletMap sessions={onMap} />
        ))}
    </div>
  );
}
