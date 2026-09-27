"use client";

import { Fragment, useEffect } from "react";
import { Circle, MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ActiveSessionView } from "@/lib/onWater";
import {
  ageLabel,
  boatColor,
  boatMotion,
  compass,
  distanceLabel,
  GOOD_FIX_M,
  isApproximate,
  mph,
  split500,
  STALE_AFTER_MS,
} from "./boatDisplay";

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// The boat's color as an arrow pointing where it's heading (a dot while
// stopped or before a heading is known), with a label beside it.
function boatIcon(color: string, label: string, stale: boolean, headingDeg: number | null) {
  const marker =
    headingDeg == null
      ? `<div style="width:18px;height:18px;border-radius:9999px;background:${color};border:3px solid white;box-shadow:0 0 0 1px rgba(0,0,0,.4)"></div>`
      : `<svg width="26" height="26" viewBox="0 0 24 24" style="transform:rotate(${Math.round(headingDeg)}deg);filter:drop-shadow(0 0 1px rgba(0,0,0,.6))">
          <path d="M12 2 L20 21 L12 17 L4 21 Z" fill="${color}" stroke="white" stroke-width="2" stroke-linejoin="round"/>
        </svg>`;
  const size = headingDeg == null ? 18 : 26;
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2 - 2],
    html: `<div style="position:relative;width:${size}px;height:${size}px;opacity:${stale ? 0.45 : 1}">
      ${marker}
      <div style="position:absolute;left:${size + 4}px;top:${size / 2 - 11}px;white-space:nowrap;font:600 12px system-ui,sans-serif;color:white;background:${color};padding:1px 6px;border-radius:4px">${escapeHtml(label)}</div>
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
        const motion = boatMotion(ping, view.prevPing);
        const name = view.boatName ?? view.coxswainName;
        const label = !stale && motion.moving && motion.speedMps != null ? `${name} · ${split500(motion.speedMps)}` : name;
        const accuracyM = ping.accuracy_m;
        return (
          <Fragment key={view.session.id}>
            {accuracyM != null && accuracyM > GOOD_FIX_M && (
              // How far off this position could be: the boat is somewhere inside.
              <Circle
                center={[ping.lat, ping.lng]}
                radius={accuracyM}
                pathOptions={{ color, weight: 1, fillOpacity: 0.08, dashArray: "4 4" }}
              />
            )}
            <Marker
              position={[ping.lat, ping.lng]}
              icon={boatIcon(color, label, stale, stale ? null : motion.headingDeg)}
            >
              <Popup>
                <strong>{view.boatName ?? "Boat not set"}</strong>
                <div>Cox: {view.coxswainName}</div>
                {isApproximate(accuracyM) && (
                  <div style={{ color: "#b45309" }}>
                    Rough location only (±{distanceLabel(accuracyM!)}) — the cox&apos;s phone needs Precise Location on
                  </div>
                )}
                {!stale && motion.speedMps != null && (
                  <div>
                    {motion.moving
                      ? `${split500(motion.speedMps)} /500m (${mph(motion.speedMps)} mph)${
                          motion.headingDeg != null ? `, heading ${compass(motion.headingDeg)}` : ""
                        }`
                      : "Stopped"}
                  </div>
                )}
                <div style={{ color: stale ? "#b91c1c" : "#4b5563" }}>
                  Last GPS {ageLabel(ping.recorded_at)} ago{stale ? " — may have stopped tracking" : ""}
                </div>
              </Popup>
            </Marker>
          </Fragment>
        );
      })}
    </MapContainer>
  );
}
