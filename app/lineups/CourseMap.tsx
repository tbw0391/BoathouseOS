"use client";

import { useEffect } from "react";
import { MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import type { CourseMarker, LatLng } from "@/lib/course";

function pin(letter: string, color: string) {
  return L.divIcon({
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<div style="width:28px;height:28px;border-radius:9999px;background:${color};border:3px solid white;box-shadow:0 0 0 1px rgba(0,0,0,.4);color:white;font:700 13px system-ui,sans-serif;display:flex;align-items:center;justify-content:center">${letter}</div>`,
  });
}
const START_ICON = pin("S", "#15803d");
const FINISH_ICON = pin("F", "#b91c1c");

// A course marker pin labeled with its distance ("500", "1k", "1.5k").
function markerIcon(m: number, active: boolean) {
  const label = m >= 1000 ? `${Number((m / 1000).toFixed(2))}k` : String(m);
  return L.divIcon({
    className: "",
    iconSize: [34, 22],
    iconAnchor: [17, 11],
    html: `<div style="min-width:34px;height:22px;padding:0 4px;border-radius:6px;background:${active ? "#1d4ed8" : "#f59e0b"};border:2px solid white;box-shadow:0 0 0 1px rgba(0,0,0,.4);color:${active ? "white" : "#111827"};font:700 11px system-ui,sans-serif;display:flex;align-items:center;justify-content:center">${label}</div>`,
  });
}

function TapToPlace({ onTap }: { onTap: ((p: LatLng) => void) | null }) {
  useMapEvents({
    click(e) {
      onTap?.({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

// Frames the course once when the map opens, then leaves panning alone.
function FitOnce({ points, center }: { points: LatLng[]; center: LatLng }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 2) map.fitBounds(points.map((p) => [p.lat, p.lng]), { padding: [40, 40], maxZoom: 16 });
    else map.setView(points[0] ?? center, points.length ? 15 : 13);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);
  return null;
}

export default function CourseMap({
  start,
  finish,
  center,
  onTap,
  markers = [],
  activeMarker = null,
}: {
  start: LatLng | null;
  finish: LatLng | null;
  center: LatLng;
  onTap: ((p: LatLng) => void) | null;
  markers?: CourseMarker[];
  activeMarker?: number | null;
}) {
  const points = [start, finish].filter((p): p is LatLng => p != null);
  const line = start && finish ? [start, ...markers, finish] : [];
  return (
    <MapContainer
      center={center}
      zoom={13}
      style={{ height: "60vh", width: "100%", cursor: onTap ? "crosshair" : undefined }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitOnce points={points} center={center} />
      <TapToPlace onTap={onTap} />
      {line.length > 1 && (
        <Polyline
          positions={line.map((p) => [p.lat, p.lng] as [number, number])}
          pathOptions={{ color: "#374151", weight: 2, dashArray: "6 6" }}
        />
      )}
      {markers.map((m) => (
        <Marker key={m.m} position={m} icon={markerIcon(m.m, activeMarker === m.m)} />
      ))}
      {start && <Marker position={start} icon={START_ICON} />}
      {finish && <Marker position={finish} icon={FINISH_ICON} />}
    </MapContainer>
  );
}
