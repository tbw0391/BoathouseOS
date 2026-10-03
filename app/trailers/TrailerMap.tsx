"use client";

import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type TrailerPin = { id: string; lat: number; lng: number; label: string; detail: string; color: string };
export type SitePin = { lat: number; lng: number; label: string };

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function pinIcon(emoji: string, label: string, color: string) {
  return L.divIcon({
    className: "",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -16],
    html: `<div style="position:relative;width:30px;height:30px">
      <div style="width:30px;height:30px;border-radius:9999px;background:white;border:3px solid ${color};display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 0 0 1px rgba(0,0,0,.3)">${emoji}</div>
      <div style="position:absolute;left:34px;top:4px;white-space:nowrap;font:600 12px system-ui,sans-serif;color:white;background:${color};padding:1px 6px;border-radius:4px">${escapeHtml(label)}</div>
    </div>`,
  });
}

// Fits everything in view the first time, then leaves panning alone.
function FitAll({ points }: { points: [number, number][] }) {
  const map = useMap();
  const has = points.length > 0;
  useEffect(() => {
    if (!has) return;
    if (points.length === 1) map.setView(points[0], 11);
    else map.fitBounds(points, { padding: [50, 50], maxZoom: 13 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [has, map]);
  return null;
}

export default function TrailerMap({ trailers, sites }: { trailers: TrailerPin[]; sites: SitePin[] }) {
  const points = [...trailers, ...sites].map((p) => [p.lat, p.lng] as [number, number]);
  return (
    <MapContainer center={points[0] ?? [39.9, -82.9]} zoom={9} style={{ height: "55vh", width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitAll points={points} />
      {sites.map((s) => (
        <Marker key={`site-${s.lat}-${s.lng}`} position={[s.lat, s.lng]} icon={pinIcon("🏁", s.label, "#111827")}>
          <Popup>
            <strong>{s.label}</strong>
          </Popup>
        </Marker>
      ))}
      {trailers.map((t) => (
        <Marker key={t.id} position={[t.lat, t.lng]} icon={pinIcon("🚚", t.label, t.color)}>
          <Popup>
            <strong>{t.label}</strong>
            <div>{t.detail}</div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
