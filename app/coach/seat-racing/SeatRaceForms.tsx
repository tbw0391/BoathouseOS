"use client";

import { useState, useTransition } from "react";
import { BOAT_CLASSES } from "@/lib/boatClasses";
import { formatErgTime, tidyErgTime } from "@/lib/erg";
import { swapBoats } from "@/lib/seatRacing";
import { addPiece, createSeatRace, deletePiece, deleteSeatRace, setPieceTimes } from "./actions";
import { unwrap } from "@/lib/userError";

type Person = { id: string; name: string };

const chip = (active: boolean) =>
  `rounded-lg border-2 px-3 py-1.5 text-sm font-medium ${
    active ? "border-[var(--color-primary)] bg-[var(--color-secondary)] text-white" : "border-gray-300 hover:border-[var(--color-primary)]"
  }`;

export function NewSeatRaceForm({ today }: { today: string }) {
  const [open, setOpen] = useState(false);
  const [boat, setBoat] = useState("2-");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="self-start bg-[var(--color-primary)] text-white rounded px-4 py-2 font-medium">
        + New seat race
      </button>
    );
  }
  return (
    <form
      className="flex flex-col gap-3 rounded-lg border-2 border-gray-200 p-3 text-sm"
      action={(fd) => {
        fd.set("boat_class", boat);
        setError(null);
        start(async () => {
          try {
            unwrap(await createSeatRace(fd));
          } catch (e) {
            if (e instanceof Error && e.message === "NEXT_REDIRECT") throw e;
            setError(e instanceof Error ? e.message : "Couldn't start it.");
          }
        });
      }}
    >
      <input name="title" placeholder="e.g. Varsity pairs" maxLength={80} className="border rounded px-3 py-2" />
      <div className="flex flex-wrap gap-2">
        {Object.keys(BOAT_CLASSES).map((b) => (
          <button key={b} type="button" onClick={() => setBoat(b)} className={chip(boat === b)}>
            {b}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1">
          Date
          <input type="date" name="raced_on" defaultValue={today} className="border rounded px-2 py-1" />
        </label>
        <label className="flex flex-col gap-1">
          Piece length (m)
          <input name="distance_m" inputMode="numeric" placeholder="1000" className="w-24 border rounded px-2 py-1" />
        </label>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="bg-[var(--color-primary)] text-white rounded px-4 py-2 font-medium disabled:opacity-50">
          Start
        </button>
        <button type="button" onClick={() => setOpen(false)} className="underline">
          Cancel
        </button>
      </div>
      {error && <p className="text-red-600">{error}</p>}
    </form>
  );
}

export function PieceEditor({
  raceId,
  piece,
  boatA,
  boatB,
}: {
  raceId: string;
  piece: { id: string; piece_no: number; time_a: number | null; time_b: number | null };
  boatA: Person[];
  boatB: Person[];
}) {
  const [a, setA] = useState(piece.time_a != null ? formatErgTime(piece.time_a) : "");
  const [b, setB] = useState(piece.time_b != null ? formatErgTime(piece.time_b) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const margin = piece.time_a != null && piece.time_b != null ? piece.time_b - piece.time_a : null;
  const dirty = a !== (piece.time_a != null ? formatErgTime(piece.time_a) : "") || b !== (piece.time_b != null ? formatErgTime(piece.time_b) : "");

  return (
    <div className="rounded-lg border-2 border-gray-200 p-3 text-sm">
      <div className="flex items-center justify-between mb-2">
        <p className="font-medium">Piece {piece.piece_no}</p>
        {margin != null && (
          <p className="text-gray-600">{margin === 0 ? "Dead heat" : `Boat ${margin > 0 ? "A" : "B"} by ${Math.abs(margin).toFixed(1)} s`}</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Boat A", people: boatA, value: a, set: setA },
          { label: "Boat B", people: boatB, value: b, set: setB },
        ].map((boat) => (
          <div key={boat.label}>
            <p className="text-gray-500">{boat.label}</p>
            <p>{boat.people.map((p) => p.name).join(", ")}</p>
            <input
              value={boat.value}
              onChange={(e) => boat.set(e.target.value)}
              onBlur={() => boat.set(tidyErgTime(boat.value))}
              placeholder="6.45.2"
              inputMode="decimal"
              className="mt-1 w-24 border rounded px-2 py-1"
            />
          </div>
        ))}
      </div>
      <div className="flex gap-3 mt-2">
        {dirty && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                try {
                  unwrap(await setPieceTimes(raceId, piece.id, a, b));
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Couldn't save.");
                }
              })
            }
            className="underline font-medium"
          >
            Save times
          </button>
        )}
        <button type="button" disabled={pending} onClick={() => start(() => deletePiece(raceId, piece.id))} className="text-gray-500 underline ml-auto">
          Remove piece
        </button>
      </div>
      {error && <p className="text-red-600 mt-1">{error}</p>}
    </div>
  );
}

// First piece: tap rowers into boat A and B. After that: pick one from
// each boat to swap for the next piece.
export function SeatRaceBuilder({
  raceId,
  seats,
  roster,
  last,
}: {
  raceId: string;
  seats: number;
  roster: Person[];
  last: { boat_a: string[]; boat_b: string[] } | null;
}) {
  const [a, setA] = useState<string[]>([]);
  const [b, setB] = useState<string[]>([]);
  const [target, setTarget] = useState<"a" | "b">("a");
  const [swapX, setSwapX] = useState<string | null>(null);
  const [swapY, setSwapY] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const name = (id: string) => roster.find((p) => p.id === id)?.name ?? "Someone";

  function submit(boatA: string[], boatB: string[], after: () => void) {
    setError(null);
    start(async () => {
      try {
        unwrap(await addPiece(raceId, boatA, boatB));
        after();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't add it.");
      }
    });
  }

  if (last) {
    return (
      <section className="flex flex-col gap-2 rounded-lg border-2 border-gray-200 p-3 text-sm">
        <h2 className="font-semibold">Next piece: swap</h2>
        <p className="text-gray-600">From boat A:</p>
        <div className="flex flex-wrap gap-2">
          {last.boat_a.map((r) => (
            <button key={r} type="button" onClick={() => setSwapX(r)} className={chip(swapX === r)}>
              {name(r)}
            </button>
          ))}
        </div>
        <p className="text-gray-600">With boat B:</p>
        <div className="flex flex-wrap gap-2">
          {last.boat_b.map((r) => (
            <button key={r} type="button" onClick={() => setSwapY(r)} className={chip(swapY === r)}>
              {name(r)}
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <button
            type="button"
            disabled={pending || !swapX || !swapY}
            onClick={() => {
              const next = swapBoats(last, swapX!, swapY!);
              submit(next.boat_a, next.boat_b, () => {
                setSwapX(null);
                setSwapY(null);
              });
            }}
            className="bg-[var(--color-primary)] text-white rounded px-4 py-2 font-medium disabled:opacity-50"
          >
            Add piece with this swap
          </button>
          <button type="button" disabled={pending} onClick={() => submit(last.boat_a, last.boat_b, () => {})} className="underline">
            Same boats again
          </button>
        </div>
        {error && <p className="text-red-600">{error}</p>}
      </section>
    );
  }

  const toggle = (id: string) => {
    if (a.includes(id)) return setA(a.filter((x) => x !== id));
    if (b.includes(id)) return setB(b.filter((x) => x !== id));
    if (target === "a" && a.length < seats) setA([...a, id]);
    else if (target === "b" && b.length < seats) setB([...b, id]);
  };

  return (
    <section className="flex flex-col gap-2 rounded-lg border-2 border-gray-200 p-3 text-sm">
      <h2 className="font-semibold">First piece</h2>
      <div className="flex gap-2">
        <button type="button" onClick={() => setTarget("a")} className={chip(target === "a")}>
          Boat A ({a.length}/{seats})
        </button>
        <button type="button" onClick={() => setTarget("b")} className={chip(target === "b")}>
          Boat B ({b.length}/{seats})
        </button>
      </div>
      <p className="text-gray-600">Tap rowers to put them in the selected boat; tap again to take them out.</p>
      <div className="flex flex-wrap gap-1">
        {roster.map((p) => {
          const inA = a.includes(p.id);
          const inB = b.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p.id)}
              className={`rounded-full border px-2 py-0.5 ${
                inA ? "bg-blue-600 border-blue-600 text-white" : inB ? "bg-orange-600 border-orange-600 text-white" : "border-gray-300"
              }`}
            >
              {inA ? "A · " : inB ? "B · " : ""}
              {p.name}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        disabled={pending || a.length === 0 || a.length !== b.length}
        onClick={() => submit(a, b, () => {})}
        className="self-start bg-[var(--color-primary)] text-white rounded px-4 py-2 font-medium disabled:opacity-50"
      >
        Add piece 1
      </button>
      {error && <p className="text-red-600">{error}</p>}
    </section>
  );
}

export function DeleteSeatRace({ raceId }: { raceId: string }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  return confirm ? (
    <p className="text-sm">
      Delete this seat race and all its pieces?{" "}
      <button type="button" disabled={pending} onClick={() => start(() => deleteSeatRace(raceId))} className="text-red-700 underline">
        Delete
      </button>{" "}
      <button type="button" onClick={() => setConfirm(false)} className="underline">
        Keep
      </button>
    </p>
  ) : (
    <button type="button" onClick={() => setConfirm(true)} className="self-start text-sm text-gray-500 underline">
      Delete seat race
    </button>
  );
}
