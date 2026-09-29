"use client";

import { unwrap, type ActionResult } from "@/lib/userError";
import { useState, useTransition } from "react";

interface Seat {
  id: string;
  seat_number: number;
  seat_role: "rower" | "coxswain" | "coach";
  rower_id: string | null;
}

function seatLabel(seat: Seat) {
  if (seat.seat_role === "coxswain") return "Cox";
  if (seat.seat_role === "coach") return "Coach";
  return `Seat ${seat.seat_number}`;
}

// Fill a boat by tapping names instead of opening a dropdown per seat. The
// next empty seat is picked for you; tapping a name fills it and moves on.
// Tap a filled seat to swap who's in it, or ✕ to empty it. Works for race
// lineups and saved crews alike — `onAssign` is the save action.
export function SeatFiller({
  seats,
  roster,
  onAssign,
}: {
  seats: Seat[];
  roster: { id: string; display_name: string }[];
  onAssign: (seatId: string, rowerId: string | null) => Promise<ActionResult<void>>;
}) {
  const [rowerBySeat, setRowerBySeat] = useState<Record<string, string | null>>(
    Object.fromEntries(seats.map((s) => [s.id, s.rower_id]))
  );
  const firstEmpty = (map: Record<string, string | null>, after?: string) => {
    const start = after ? seats.findIndex((s) => s.id === after) + 1 : 0;
    const ordered = [...seats.slice(start), ...seats.slice(0, start)];
    return ordered.find((s) => !map[s.id])?.id ?? null;
  };
  const [activeSeatId, setActiveSeatId] = useState<string | null>(() => firstEmpty(rowerBySeat));
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const nameById = new Map(roster.map((p) => [p.id, p.display_name]));
  const seated = new Set(Object.values(rowerBySeat).filter((id): id is string => !!id));

  function save(seatId: string, rowerId: string | null) {
    const previous = rowerBySeat;
    const next = { ...rowerBySeat, [seatId]: rowerId };
    setRowerBySeat(next);
    setActiveSeatId(rowerId ? firstEmpty(next, seatId) : seatId);
    setError(null);
    startTransition(async () => {
      try {
        unwrap(await onAssign(seatId, rowerId));
      } catch (e) {
        setRowerBySeat(previous);
        setError(e instanceof Error ? e.message : "Couldn't save that seat.");
      }
    });
  }

  const available = roster.filter((p) => !seated.has(p.id));

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1.5">
        {seats.map((seat) => {
          const rowerId = rowerBySeat[seat.id];
          const active = seat.id === activeSeatId;
          return (
            <li key={seat.id} className="flex items-center gap-2 text-sm">
              <button
                type="button"
                onClick={() => setActiveSeatId(seat.id)}
                className={`flex-1 flex items-center justify-between gap-2 rounded-lg border-2 px-3 py-1.5 text-left ${
                  active ? "border-[var(--color-primary)] bg-yellow-50" : "border-gray-200"
                }`}
              >
                <span className="text-gray-500 w-16 shrink-0">{seatLabel(seat)}</span>
                <span className={`flex-1 truncate ${rowerId ? "font-medium" : "text-gray-400"}`}>
                  {rowerId ? nameById.get(rowerId) ?? "Unknown" : active ? "Tap a name below" : "empty"}
                </span>
              </button>
              {rowerId && (
                <button
                  type="button"
                  onClick={() => save(seat.id, null)}
                  aria-label={`Empty ${seatLabel(seat)}`}
                  className="text-gray-400 hover:text-red-600 px-1"
                >
                  ✕
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {activeSeatId && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            {seatLabel(seats.find((s) => s.id === activeSeatId) as Seat)}:
          </p>
          {available.length === 0 ? (
            <p className="text-sm text-gray-500">Everyone eligible is already in this boat.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {available.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => save(activeSeatId, p.id)}
                  className="rounded-full border-2 border-gray-300 px-3 py-1 text-sm hover:border-[var(--color-primary)] hover:bg-[var(--color-secondary)] hover:text-white"
                >
                  {p.display_name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
