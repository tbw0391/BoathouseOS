// Erg workouts (/workouts): pieces, time math, and Concept2 logbook imports.

export const ERG_PIECES: { label: string; distance?: number; seconds?: number }[] = [
  { label: "2K", distance: 2000 },
  { label: "5K", distance: 5000 },
  { label: "6K", distance: 6000 },
  { label: "1K", distance: 1000 },
  { label: "500m", distance: 500 },
  { label: "30 min", seconds: 1800 },
  { label: "60 min", seconds: 3600 },
];

// Phones' number pad has "." but no ":", so dots can stand in for colons.
// Erg times only go to tenths, so a one-digit last part is tenths and every
// other dot is a colon: "6.45.2" -> "6:45.2", "1.02.03" -> "1:02:03",
// "6.45" -> "6:45". "95.5" stays 95.5 seconds.
export function normalizeErgTimeText(text: string): string {
  const t = text.trim();
  if (t.includes(":") || !t.includes(".")) return t;
  const parts = t.split(".");
  const last = parts[parts.length - 1];
  if (last.length === 1) {
    return parts.length === 2 ? t : `${parts.slice(0, -1).join(":")}.${last}`;
  }
  return parts.join(":");
}

// "6:45.2", "1:02:03", "95.5" (or the dotted forms above) -> seconds;
// anything else -> null.
export function parseErgTime(text: string): number | null {
  const t = normalizeErgTimeText(text);
  const m = t.match(/^(?:(\d{1,2}):)?(?:(\d{1,3}):)?(\d{1,2}(?:\.\d+)?)$/);
  if (!m) return null;
  const parts = [m[1], m[2]].filter((x) => x !== undefined).map(Number);
  const secs = Number(m[3]);
  if (parts.length > 0 && secs >= 60) return null;
  let total = secs;
  if (parts.length === 1) total += parts[0] * 60;
  if (parts.length === 2) {
    if (parts[1] >= 60) return null;
    total += parts[0] * 3600 + parts[1] * 60;
  }
  return total > 0 ? Math.round(total * 10) / 10 : null;
}

export function formatErgTime(seconds: number): string {
  const tenths = Math.round(seconds * 10);
  const h = Math.floor(tenths / 36000);
  const m = Math.floor((tenths % 36000) / 600);
  const s = (tenths % 600) / 10;
  const ss = s.toFixed(1).padStart(4, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export function split500(distanceM: number, seconds: number): number {
  return (seconds / distanceM) * 500;
}

// Concept2's watts formula: 2.80 / pace³, pace in seconds per metre.
export function ergWatts(distanceM: number, seconds: number): number {
  return Math.round(2.8 / Math.pow(seconds / distanceM, 3));
}

// Concept2's weight adjustment: time × (weight lb / 270)^0.222.
export function weightAdjusted(seconds: number, weightLbs: number): number {
  return seconds * Math.pow(weightLbs / 270, 0.222);
}

// "2K" / "5K" when a piece is exactly that test, so the profile time can
// follow it.
export function testDistance(distanceM: number | null, piece: string): "2k" | "5k" | null {
  if (distanceM === 2000 && /^(2\s*k|2,?000\s*m?)(\s+test)?$/i.test(piece.trim())) return "2k";
  if (distanceM === 5000 && /^(5\s*k|5,?000\s*m?)(\s+test)?$/i.test(piece.trim())) return "5k";
  return null;
}

function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}

export type ImportedWorkout = {
  sourceRef: string;
  doneOn: string;
  piece: string;
  distanceM: number | null;
  timeSeconds: number | null;
  strokeRate: number | null;
  notes: string | null;
};

// A Concept2 logbook export (log.concept2.com > History > Export). Only
// RowErg pieces; columns found by name so extra or reordered ones are fine.
export function parseConcept2Csv(text: string): ImportedWorkout[] {
  const rows = csvRows(text.replace(/^﻿/, ""));
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (...names: string[]) => header.findIndex((h) => names.some((n) => h === n || h.startsWith(n)));
  const iId = col("id", "log id");
  const iDate = col("date");
  const iDesc = col("description");
  const iSecs = col("work time (seconds)");
  const iTime = col("work time (formatted)", "work time");
  const iDist = col("work distance");
  const iRate = col("stroke rate");
  const iType = col("type");
  const iComments = col("comments");
  if (iDate < 0 || (iSecs < 0 && iTime < 0) || iDist < 0) return [];

  const out: ImportedWorkout[] = [];
  for (const r of rows.slice(1)) {
    const type = iType >= 0 ? (r[iType] ?? "").trim().toLowerCase() : "";
    if (type && !type.includes("row")) continue;
    const date = (r[iDate] ?? "").trim().match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
    if (!date) continue;
    const secs = iSecs >= 0 && r[iSecs]?.trim() ? Number(r[iSecs]) : parseErgTime(r[iTime] ?? "");
    const dist = Number((r[iDist] ?? "").replace(/,/g, ""));
    const rate = iRate >= 0 ? Number(r[iRate]) : NaN;
    const desc = iDesc >= 0 ? (r[iDesc] ?? "").trim() : "";
    out.push({
      sourceRef: iId >= 0 && r[iId]?.trim() ? `c2:${r[iId].trim()}` : `c2:${date}:${dist}:${secs}`,
      doneOn: date,
      piece: (desc || (dist ? `${dist}m` : "Workout")).slice(0, 60),
      distanceM: Number.isFinite(dist) && dist > 0 ? Math.round(dist) : null,
      timeSeconds: secs != null && Number.isFinite(secs) && secs > 0 ? Math.round(secs * 10) / 10 : null,
      strokeRate: Number.isFinite(rate) && rate >= 10 && rate <= 60 ? Math.round(rate) : null,
      notes: iComments >= 0 ? (r[iComments] ?? "").trim() || null : null,
    });
  }
  return out.filter((w) => w.distanceM != null || w.timeSeconds != null);
}

// One result from the Concept2 Logbook API (GET /api/users/me/results).
// Time is in tenths of a second.
export type Concept2Result = {
  id: number;
  date: string;
  type: string;
  distance: number | null;
  time: number | null;
  workout_type?: string | null;
  stroke_rate?: number | null;
  comments?: string | null;
};

// The same shape the CSV import makes, with the same "c2:<id>" reference,
// so a piece imported both ways is only kept once. Only RowErg pieces.
export function concept2ResultToWorkout(r: Concept2Result): ImportedWorkout | null {
  if (r.type !== "rower") return null;
  const doneOn = r.date?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
  if (!doneOn) return null;
  const distanceM = r.distance != null && r.distance > 0 && r.distance <= 100000 ? Math.round(r.distance) : null;
  const timeSeconds = r.time != null && r.time > 0 && r.time < 360000 ? Math.round(r.time) / 10 : null;
  if (distanceM == null && timeSeconds == null) return null;
  const kind = r.workout_type ?? "";
  const piece = /Interval/i.test(kind)
    ? "Intervals"
    : kind === "FixedTimeSplits" && timeSeconds != null
      ? formatErgTime(timeSeconds).replace(/\.0$/, "")
      : distanceM != null
        ? `${distanceM}m`
        : "Workout";
  const rate = r.stroke_rate ?? NaN;
  return {
    sourceRef: `c2:${r.id}`,
    doneOn,
    piece,
    distanceM,
    timeSeconds,
    strokeRate: Number.isFinite(rate) && rate >= 10 && rate <= 60 ? Math.round(rate) : null,
    notes: r.comments?.trim().slice(0, 500) || null,
  };
}

// What a time box shows once you leave it: "6.45.2" -> "6:45.2". Left as
// typed if it isn't a time, so the save can say what's wrong.
export function tidyErgTime(text: string): string {
  const seconds = parseErgTime(text);
  return seconds == null ? text : formatErgTime(seconds);
}
