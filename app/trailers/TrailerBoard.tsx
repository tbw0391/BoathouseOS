"use client";

import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { unwrap } from "@/lib/userError";
import { endTrailerTrip } from "./actions";
import type { SitePin, TrailerPin } from "./TrailerMap";

const TrailerMap = dynamic(() => import("./TrailerMap"), { ssr: false });

export type TrailerRow = {
  tripId: string;
  label: string;
  status: string;
  onRoad: boolean;
  pin: TrailerPin | null;
};

export type RegattaRow = {
  eventId: string;
  title: string;
  when: string;
  site: SitePin | null;
  trailers: TrailerRow[];
};

// Everyone: where the trailers are and how far out, on a map.
export function TrailerBoard({ regattas, canStop }: { regattas: RegattaRow[]; canStop: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const pins = regattas.flatMap((r) => r.trailers.flatMap((t) => (t.onRoad && t.pin ? [t.pin] : [])));
  const sites = regattas.flatMap((r) => (r.site ? [r.site] : []));

  function stop(tripId: string) {
    setError(null);
    start(async () => {
      try {
        unwrap(await endTrailerTrip(tripId));
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't stop tracking.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {pins.length > 0 && (
        <div className="rounded-lg overflow-hidden border">
          <TrailerMap trailers={pins} sites={sites} />
        </div>
      )}
      {regattas.map((r) => (
        <section key={r.eventId} className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">
            {r.title} <span className="text-sm font-normal text-gray-500">· {r.when}</span>
          </h2>
          {r.trailers.length === 0 && <p className="text-sm text-gray-500">No trailer is being tracked yet.</p>}
          {r.trailers.map((t) => (
            <div key={t.tripId} className="flex items-center gap-3 rounded-lg border px-4 py-3">
              {t.pin && (
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: t.pin.color }} aria-hidden />
              )}
              <div className="flex-1">
                <p className="font-medium">{t.label}</p>
                <p className="text-sm text-gray-600">{t.status}</p>
              </div>
              {canStop && t.onRoad && (
                <button
                  onClick={() => stop(t.tripId)}
                  disabled={pending}
                  className="text-sm border-2 border-[var(--color-primary)] rounded px-3 py-1.5 disabled:opacity-50"
                >
                  Stop
                </button>
              )}
            </div>
          ))}
          {!r.site && (
            <p className="text-xs text-amber-700">
              This regatta has no location yet, so there&apos;s no &quot;30 minutes out&quot; alert. Add its location
              on the schedule, or the finish line on its Course tab.
            </p>
          )}
        </section>
      ))}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
