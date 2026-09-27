"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ActiveSessionView } from "@/lib/onWater";
import { ageLabel, boatColor, STALE_AFTER_MS } from "./boatDisplay";

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// A dot in the boat's color with the boat name beside it.
function boatIcon(color: string, label: string, stale: boolean) {
  return L.divIcon({
    className: "",
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10],
    html: `<div style="position:relative;width:18px;height:18px">
      <div style="width:18px;height:18px;border-radius:9999px;background:${color};border:3px solid white;box-shadow:0 0 0 1px rgba(0,0,0,.4);opacity:${stale ? 0.45 : 1}"></div>
      <div style="position:absolute;left:22px;top:-2px;white-space:nowrap;font:600 12px system-ui,sans-serif;color:white;background:${color};padding:1px 6px;border-radius:4px">${escapeHtml(label)}</div>
    </div>`,
  });
}

// Zooms to fit every boat the first time boats appear, then leaves the
// coach's panning and zooming alone.
function FitToBoats({ points }: { points: [number, number][] }) {
  const map = useMap();
  const hasPoints = points.length > 0;
  useEffect(() => {
    if (!hasPoints) return;
    if (points.length === 1) map.setView(points[0], 15);
    else map.fitBounds(points, { padding: [40, 40], maxZoom: 16 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPoints, map]);
  return null;
}

export default function LeafletMap({ sessions }: { sessions: ActiveSessionView[] }) {
  const points = sessions.map((v) => [v.lastPing!.lat, v.lastPing!.lng] as [number, number]);

  return (
    <MapContainer center={points[0] ?? [39.9, -82.9]} zoom={14} style={{ height: "70vh", width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitToBoats points={points} />
      {sessions.map((view) => {
        const ping = view.lastPing!;
        const stale = Date.now() - new Date(ping.recorded_at).getTime() > STALE_AFTER_MS;
        const color = boatColor(view.session.color);
        return (
          <Marker
            key={view.session.id}
            position={[ping.lat, ping.lng]}
            icon={boatIcon(color, view.boatName ?? view.coxswainName, stale)}
          >
            <Popup>
              <strong>{view.boatName ?? "Boat not set"}</strong>
              <div>Cox: {view.coxswainName}</div>
              <div style={{ color: stale ? "#b91c1c" : "#4b5563" }}>
                Last GPS {ageLabel(ping.recorded_at)} ago{stale ? " — may have stopped tracking" : ""}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
