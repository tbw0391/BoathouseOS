// Course markers that follow the river (2026-10-03, Todd): given the start
// and finish pins and the river's centerline from OpenStreetMap (waterway
// lines, fetched by the Course tab's server action), find the way along the
// water from start to finish and put a marker at each distance along it.
// When there's no usable river line, or it's no different from a straight
// line, the markers go on the straight line instead. Pure functions, so the
// path finding can be tested without the network.

import type { CourseMarker, LatLng } from "@/lib/course";

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;

export function distanceM(a: LatLng, b: LatLng): number {
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// The closest point to p on segment a-b (flat-earth, fine over a few km),
// and how far along the segment it is (0..1).
function closestOnSegment(p: LatLng, a: LatLng, b: LatLng): { point: LatLng; t: number } {
  const k = Math.cos(rad(a.lat));
  const ax = a.lng * k, ay = a.lat, bx = b.lng * k, by = b.lat, px = p.lng * k, py = p.lat;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return { point: { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t }, t };
}

type Graph = { points: LatLng[]; edges: Map<number, { to: number; m: number }[]> };

const key = (p: LatLng) => `${p.lat.toFixed(7)},${p.lng.toFixed(7)}`;

// River lines (each a list of points) into one graph; lines that share a
// point join there.
export function buildGraph(lines: LatLng[][]): Graph {
  const points: LatLng[] = [];
  const index = new Map<string, number>();
  const edges = new Map<number, { to: number; m: number }[]>();
  const id = (p: LatLng) => {
    const k = key(p);
    let i = index.get(k);
    if (i == null) {
      i = points.length;
      points.push(p);
      index.set(k, i);
      edges.set(i, []);
    }
    return i;
  };
  const link = (a: number, b: number) => {
    if (a === b) return;
    const m = distanceM(points[a], points[b]);
    edges.get(a)!.push({ to: b, m });
    edges.get(b)!.push({ to: a, m });
  };
  for (const line of lines) {
    for (let i = 1; i < line.length; i++) link(id(line[i - 1]), id(line[i]));
  }
  return { points, edges };
}

// Put a pin onto the nearest river segment, adding it to the graph. Returns
// the new point's index and how far the pin was from the river.
function snap(g: Graph, p: LatLng): { node: number; offM: number } | null {
  let best: { a: number; b: number; point: LatLng; d: number } | null = null;
  for (const [a, list] of g.edges) {
    for (const { to: b } of list) {
      if (b < a) continue;
      const { point } = closestOnSegment(p, g.points[a], g.points[b]);
      const d = distanceM(p, point);
      if (!best || d < best.d) best = { a, b, point, d };
    }
  }
  if (!best) return null;
  const node = g.points.length;
  g.points.push(best.point);
  g.edges.set(node, []);
  for (const end of [best.a, best.b]) {
    const m = distanceM(best.point, g.points[end]);
    g.edges.get(node)!.push({ to: end, m });
    g.edges.get(end)!.push({ to: node, m });
  }
  return { node, offM: best.d };
}

// Shortest way along the graph (Dijkstra; river graphs here are small).
function shortestPath(g: Graph, from: number, to: number): number[] | null {
  const dist = new Map<number, number>([[from, 0]]);
  const prev = new Map<number, number>();
  const done = new Set<number>();
  for (;;) {
    let u = -1;
    let best = Infinity;
    for (const [n, d] of dist) {
      if (!done.has(n) && d < best) {
        best = d;
        u = n;
      }
    }
    if (u === -1) return null;
    if (u === to) break;
    done.add(u);
    for (const { to: v, m } of g.edges.get(u) ?? []) {
      const nd = best + m;
      if (nd < (dist.get(v) ?? Infinity)) {
        dist.set(v, nd);
        prev.set(v, u);
      }
    }
  }
  const path = [to];
  while (path[0] !== from) path.unshift(prev.get(path[0])!);
  return path;
}

export function pathLengthM(path: LatLng[]): number {
  let m = 0;
  for (let i = 1; i < path.length; i++) m += distanceM(path[i - 1], path[i]);
  return m;
}

// The point `meters` along a path, or null past its end.
export function pointAlong(path: LatLng[], meters: number): LatLng | null {
  let left = meters;
  for (let i = 1; i < path.length; i++) {
    const seg = distanceM(path[i - 1], path[i]);
    if (left <= seg) {
      const f = seg === 0 ? 0 : left / seg;
      return {
        lat: path[i - 1].lat + (path[i].lat - path[i - 1].lat) * f,
        lng: path[i - 1].lng + (path[i].lng - path[i - 1].lng) * f,
      };
    }
    left -= seg;
  }
  return null;
}

export type CourseLine = {
  path: LatLng[]; // start, along the water, finish
  followsRiver: boolean;
  lengthM: number;
};

// The way from start to finish: along the river when the pins are both near
// one connected river line (within maxOffM) and that way is noticeably
// different from a straight line; otherwise the straight line.
export function courseLine(start: LatLng, finish: LatLng, lines: LatLng[][], maxOffM = 250): CourseLine {
  const straight: CourseLine = { path: [start, finish], followsRiver: false, lengthM: distanceM(start, finish) };
  const usable = lines.filter((l) => l.length >= 2);
  if (usable.length === 0) return straight;
  const g = buildGraph(usable);
  const s = snap(g, start);
  const f = snap(g, finish);
  if (!s || !f || s.offM > maxOffM || f.offM > maxOffM) return straight;
  const nodes = shortestPath(g, s.node, f.node);
  if (!nodes) return straight;
  const path = [start, ...nodes.map((n) => g.points[n]), finish];
  const lengthM = pathLengthM(path);
  // Not really a river route (wildly longer than the pins are apart), or no
  // bend worth following (within 1% of straight): use the straight line.
  if (lengthM > straight.lengthM * 3 || lengthM < straight.lengthM * 1.01) return straight;
  return { path, followsRiver: true, lengthM };
}

// Markers at each distance along the course line, skipping any at or past
// the finish.
export function markersOnLine(line: CourseLine, distances: number[]): CourseMarker[] {
  return [...new Set(distances.map((d) => Math.round(d)).filter((d) => d > 0))]
    .sort((a, b) => a - b)
    .filter((m) => m < line.lengthM)
    .map((m) => ({ m, ...pointAlong(line.path, m)! }));
}

// "500, 1000, 2000" (or with spaces / "1,000"-style thousands written 1000).
export function parseDistances(text: string): number[] {
  return text
    .split(/[\s,;]+/)
    .map((t) => Number(t.replace(/m$/i, "")))
    .filter((n) => Number.isFinite(n) && n > 0 && n < 20000)
    .map((n) => Math.round(n));
}
