"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { createClient } from "@/lib/supabase/client";
import type { LocationPing, OnWaterSession } from "@/lib/database.types";
import type { ActiveSessionView } from "./page";

L.Icon.Default.mergeOptions({
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  iconUrl: "/leaflet/marker-icon.png",
  shadowUrl: "/leaflet/marker-shadow.png",
});

const STALE_AFTER_MS = 60000;

export default function LeafletMap({ initialSessions }: { initialSessions: ActiveSessionView[] }) {
  const [sessions, setSessions] = useState(initialSessions);
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const channel = supabase
      .channel("coach-tracking")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "location_pings" },
        (payload) => {
          const ping = payload.new as LocationPing;
          setSessions((prev) =>
            prev.map((view) =>
              view.session.id === ping.session_id ? { ...view, lastPing: ping } : view
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
          const [{ data: profile }, lineupResult] = await Promise.all([
            supabase.from("profiles").select("display_name").eq("id", inserted.coxswain_id).single(),
            inserted.lineup_id
              ? supabase.from("lineups").select("boat_name").eq("id", inserted.lineup_id).single()
              : Promise.resolve({ data: null }),
          ]);
          if (cancelled) return;
          setSessions((prev) => [
            ...prev,
            {
              session: inserted,
              coxswainName: (profile as { display_name: string } | null)?.display_name ?? "Unknown",
              boatName: (lineupResult.data as { boat_name: string } | null)?.boat_name ?? null,
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

  const pinned = sessions.filter((v) => v.lastPing);
  const center: [number, number] = pinned[0]?.lastPing
    ? [pinned[0].lastPing.lat, pinned[0].lastPing.lng]
    : [39.9, -82.9];

  return (
    <div className="flex flex-col gap-3">
      {sessions.length > pinned.length && (
        <p className="text-sm text-gray-500">
          {sessions.length - pinned.length} outing(s) started, waiting for a first GPS fix…
        </p>
      )}
      <MapContainer center={center} zoom={13} style={{ height: "70vh", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {pinned.map((view) => {
          const ping = view.lastPing!;
          const ageSec = Math.floor((Date.now() - new Date(ping.recorded_at).getTime()) / 1000);
          const stale = Date.now() - new Date(ping.recorded_at).getTime() > STALE_AFTER_MS;
          return (
            <Marker key={view.session.id} position={[ping.lat, ping.lng]}>
              <Popup>
                <strong>{view.coxswainName}</strong>
                {view.boatName && <div>{view.boatName}</div>}
                <div style={{ color: stale ? "#b91c1c" : "#4b5563" }}>
                  Last ping {ageSec}s ago{stale ? " — may have stopped tracking" : ""}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
