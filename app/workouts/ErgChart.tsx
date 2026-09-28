"use client";

import { useState } from "react";
import { formatErgTime } from "@/lib/erg";

type Point = { date: string; seconds: number };

const W = 600;
const H = 220;
const PAD = { top: 16, right: 16, bottom: 28, left: 56 };

function shortDate(key: string) {
  return new Date(`${key}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

// One test's times over time. Faster is higher, since that's the direction
// rowers read as better. The history table below is the table view.
export function ErgChart({ series }: { series: Record<string, Point[]> }) {
  const names = Object.keys(series).filter((k) => series[k].length > 0);
  const [picked, setPicked] = useState(names[0] ?? null);
  const [hover, setHover] = useState<number | null>(null);
  const name = picked && names.includes(picked) ? picked : (names[0] ?? null);

  if (!name) return <p className="text-sm text-gray-500">Log a 2K or 5K to see progress here.</p>;
  const points = series[name];

  const t0 = new Date(points[0].date).getTime();
  const t1 = new Date(points.at(-1)!.date).getTime();
  const secs = points.map((p) => p.seconds);
  const lo = Math.min(...secs);
  const hi = Math.max(...secs);
  const pad = Math.max(2, (hi - lo) * 0.15);
  const yMin = lo - pad;
  const yMax = hi + pad;
  const x = (d: string) =>
    t1 === t0 ? PAD.left + (W - PAD.left - PAD.right) / 2 : PAD.left + ((new Date(d).getTime() - t0) / (t1 - t0)) * (W - PAD.left - PAD.right);
  // Faster (smaller) at the top.
  const y = (s: number) => PAD.top + ((s - yMin) / (yMax - yMin)) * (H - PAD.top - PAD.bottom);
  const ticks = [0, 1, 2, 3].map((i) => yMin + ((yMax - yMin) * i) / 3);
  const best = Math.min(...secs);
  const h = hover != null ? points[hover] : null;

  return (
    <div className="flex flex-col gap-2">
      {names.length > 1 && (
        <div className="flex gap-2">
          {names.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                setPicked(n);
                setHover(null);
              }}
              className={`rounded-lg border-2 px-3 py-1 text-sm font-medium ${
                n === name ? "border-[var(--color-primary)] bg-[var(--color-secondary)] text-white" : "border-gray-300"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      )}
      <p className="text-sm text-gray-600">
        {name} time, best {formatErgTime(best)} · faster is higher
      </p>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`${name} times over time`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="currentColor" className="text-gray-200" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" className="fill-gray-500" fontSize={11}>
                {formatErgTime(t)}
              </text>
            </g>
          ))}
          <text x={PAD.left} y={H - 8} className="fill-gray-500" fontSize={11}>
            {shortDate(points[0].date)}
          </text>
          {points.length > 1 && (
            <text x={W - PAD.right} y={H - 8} textAnchor="end" className="fill-gray-500" fontSize={11}>
              {shortDate(points.at(-1)!.date)}
            </text>
          )}
          {points.length > 1 && (
            <polyline
              points={points.map((p) => `${x(p.date)},${y(p.seconds)}`).join(" ")}
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {h && <line x1={x(h.date)} x2={x(h.date)} y1={PAD.top} y2={H - PAD.bottom} stroke="currentColor" className="text-gray-300" strokeWidth={1} />}
          {points.map((p, i) => (
            <g key={i}>
              <circle
                cx={x(p.date)}
                cy={y(p.seconds)}
                r={p.seconds === best ? 5 : 4}
                fill="var(--color-primary)"
                stroke="white"
                strokeWidth={2}
              />
              {/* Bigger invisible target for hover and tap. */}
              <circle
                cx={x(p.date)}
                cy={y(p.seconds)}
                r={14}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onClick={() => setHover(hover === i ? null : i)}
              />
            </g>
          ))}
        </svg>
        {h && (
          <div
            className="absolute pointer-events-none rounded bg-white border border-gray-200 shadow px-2 py-1 text-xs"
            style={{
              left: `${(x(h.date) / W) * 100}%`,
              top: `${(y(h.seconds) / H) * 100}%`,
              transform: `translate(${x(h.date) > W * 0.7 ? "-105%" : "8px"}, -120%)`,
            }}
          >
            <span className="font-semibold tabular-nums">{formatErgTime(h.seconds)}</span>
            <span className="text-gray-500"> · {shortDate(h.date)}</span>
            {h.seconds === best && <span className="text-gray-500"> · best</span>}
          </div>
        )}
      </div>
    </div>
  );
}
