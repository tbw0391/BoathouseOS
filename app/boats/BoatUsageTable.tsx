"use client";

import { useState, useTransition } from "react";
import { SERVICE_INTERVAL_OPTIONS, type BoatUsage } from "@/lib/boatUsage";
import { markServiced, setServiceInterval } from "./usageActions";

export type UsageRow = {
  id: string;
  name: string;
  serviceEveryKm: number | null;
  lastServiceAt: string | null;
  usage: BoatUsage;
};

const km = (n: number) => (n >= 100 ? Math.round(n).toLocaleString() : n.toFixed(1));

// Distance and time on the water from On the Water outings over the last
// year, and service due by distance.
export function BoatUsageTable({ rows, canManage }: { rows: UsageRow[]; canManage: boolean }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<void>) =>
    start(async () => {
      setError(null);
      try {
        await fn();
        setEditing(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save.");
      }
    });

  return (
    <section className="mt-8 max-w-3xl">
      <h2 className="text-lg font-semibold">Usage</h2>
      <p className="text-sm text-gray-600 mb-2">
        From On the Water tracking over the last 12 months. Only outings where the cox picked the boat count.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="py-1 pr-2 font-normal">Boat</th>
              <th className="py-1 pr-2 font-normal text-right">Outings</th>
              <th className="py-1 pr-2 font-normal text-right">km</th>
              <th className="py-1 pr-2 font-normal text-right">Hours</th>
              <th className="py-1 pr-2 font-normal">Since service</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-gray-100 align-top">
                <td className="py-1 pr-2">{r.name}</td>
                <td className="py-1 pr-2 text-right tabular-nums">{r.usage.outings}</td>
                <td className="py-1 pr-2 text-right tabular-nums">{km(r.usage.km)}</td>
                <td className="py-1 pr-2 text-right tabular-nums">{r.usage.hours.toFixed(1)}</td>
                <td className="py-1 pr-2">
                  <span className={r.usage.due ? "text-red-700 font-medium" : ""}>
                    {km(r.usage.kmSinceService)} km
                    {r.serviceEveryKm ? ` of ${r.serviceEveryKm.toLocaleString()}` : ""}
                    {r.usage.due && " · service due"}
                  </span>
                  {r.lastServiceAt && (
                    <span className="block text-xs text-gray-500">
                      Serviced {new Date(r.lastServiceAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  )}
                  {canManage && editing !== r.id && (
                    <span className="flex gap-2 text-xs mt-0.5">
                      <button type="button" onClick={() => setEditing(r.id)} className="underline text-gray-600">
                        Set interval
                      </button>
                      <button type="button" disabled={pending} onClick={() => run(() => markServiced(r.id))} className="underline text-gray-600">
                        Serviced today
                      </button>
                    </span>
                  )}
                  {canManage && editing === r.id && (
                    <span className="flex flex-wrap gap-1 mt-1">
                      {SERVICE_INTERVAL_OPTIONS.map((n) => (
                        <button
                          key={n}
                          type="button"
                          disabled={pending}
                          onClick={() => run(() => setServiceInterval(r.id, n))}
                          className={`rounded border px-2 py-0.5 text-xs ${r.serviceEveryKm === n ? "border-[var(--color-primary)] font-semibold" : "border-gray-300"}`}
                        >
                          {n.toLocaleString()} km
                        </button>
                      ))}
                      <button type="button" disabled={pending} onClick={() => run(() => setServiceInterval(r.id, null))} className="rounded border border-gray-300 px-2 py-0.5 text-xs">
                        None
                      </button>
                      <button type="button" onClick={() => setEditing(null)} className="text-xs underline">
                        Cancel
                      </button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
    </section>
  );
}
