"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { oarLabel, tapeSwatch } from "@/lib/oarSheet";
import { unwrapIfResult } from "@/lib/userError";
import { fillBoatWithColor, setSeatOar, setTaskPerson } from "./actions";

export type OarSeatRow = {
  seatNumber: number;
  label: string;
  rowerName: string;
  oar: { color: string; rings: number } | null;
  // Other boats at this regatta with the same oar.
  alsoIn: string[];
};

export type TaskRow = { id: string; name: string; people: { id: string; name: string }[] };

const ROLE_LABEL: Record<string, string> = {
  rower: "Rower",
  coxswain: "Cox",
  parent: "Parent",
  coach: "Coach",
  admin: "Admin",
};

function Swatch({ color }: { color: string }) {
  return (
    <span
      className="inline-block w-4 h-4 rounded-full border border-gray-400 shrink-0"
      style={{ backgroundColor: tapeSwatch(color) }}
      aria-hidden
    />
  );
}

export function OarSheetForm({
  lineupId,
  colors,
  maxRings,
  seats,
  tasks,
  roster,
}: {
  lineupId: string;
  colors: string[];
  maxRings: number;
  seats: OarSeatRow[];
  tasks: TaskRow[];
  roster: { id: string; name: string; role: string }[];
}) {
  const [openSeat, setOpenSeat] = useState<number | null>(null);
  const [pickedColor, setPickedColor] = useState<string | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(fn: () => Promise<unknown>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        unwrapIfResult(await fn());
        after?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save.");
      }
    });
  }

  function openPicker(seatNumber: number, current: OarSeatRow["oar"]) {
    setOpenSeat(openSeat === seatNumber ? null : seatNumber);
    setPickedColor(current?.color ?? null);
  }

  const matches = search.trim()
    ? roster.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 12)
    : [];

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="font-semibold mb-1">Oars</h2>
        <p className="text-sm text-gray-500 mb-3">Tap a seat, then its tape color and number of rings.</p>

        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-1.5">Whole boat one color (bow = 1 ring, up to stroke):</p>
          <div className="flex flex-wrap gap-2">
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                disabled={isPending}
                onClick={() => run(() => fillBoatWithColor(lineupId, c))}
                className="flex items-center gap-1.5 rounded-lg border-2 border-gray-300 px-3 py-1.5 text-sm hover:border-[var(--color-primary)] disabled:opacity-60"
              >
                <Swatch color={c} />
                {c}
              </button>
            ))}
          </div>
        </div>

        <ul className="flex flex-col gap-2">
          {seats.map((s) => (
            <li key={s.seatNumber} className="rounded-lg border-2 border-gray-200">
              <button
                type="button"
                onClick={() => openPicker(s.seatNumber, s.oar)}
                aria-expanded={openSeat === s.seatNumber}
                className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left text-sm"
              >
                <span className="min-w-0">
                  <span className="font-medium">{s.label}</span>
                  <span className="text-gray-500"> · {s.rowerName}</span>
                </span>
                {s.oar ? (
                  <span className="flex items-center gap-1.5 font-medium">
                    <Swatch color={s.oar.color} />
                    {oarLabel({ rings: s.oar.rings, tape_color: s.oar.color })}
                  </span>
                ) : (
                  <span className="text-[var(--color-primary)] font-medium">Pick oar</span>
                )}
              </button>
              {s.alsoIn.length > 0 && (
                <p className="px-3 pb-2 text-xs text-amber-700">Also picked for {s.alsoIn.join(", ")}.</p>
              )}

              {openSeat === s.seatNumber && (
                <div className="border-t px-3 py-3 flex flex-col gap-3">
                  <div className="flex flex-wrap gap-2">
                    {colors.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setPickedColor(c)}
                        aria-pressed={pickedColor === c}
                        className={`flex items-center gap-1.5 rounded-lg border-2 px-3 py-1.5 text-sm ${
                          pickedColor === c ? "border-[var(--color-primary)] font-medium" : "border-gray-300"
                        }`}
                      >
                        <Swatch color={c} />
                        {c}
                      </button>
                    ))}
                  </div>
                  {pickedColor && (
                    <div className="flex flex-wrap gap-2" aria-label="Rings">
                      {Array.from({ length: maxRings }, (_, i) => i + 1).map((n) => (
                        <button
                          key={n}
                          type="button"
                          disabled={isPending}
                          onClick={() =>
                            run(
                              () => setSeatOar(lineupId, s.seatNumber, { color: pickedColor, rings: n }),
                              () => setOpenSeat(null)
                            )
                          }
                          className={`w-11 h-11 rounded-lg border-2 text-sm font-medium disabled:opacity-60 ${
                            s.oar?.color === pickedColor && s.oar.rings === n
                              ? "border-[var(--color-primary)] bg-[var(--color-secondary)] text-white"
                              : "border-gray-300"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  )}
                  {s.oar && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => run(() => setSeatOar(lineupId, s.seatNumber, null), () => setOpenSeat(null))}
                      className="self-start text-sm text-gray-500 underline"
                    >
                      Clear this seat
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-semibold mb-1">Launch and Recovery</h2>
        <p className="text-sm text-gray-500 mb-3">Pick anyone on the roster. They get an alert.</p>
        {tasks.length === 0 && <p className="text-sm text-gray-500">This boat has no Launch or Recovery task.</p>}
        <div className="flex flex-col gap-3">
          {tasks.map((t) => (
            <div key={t.id} className="rounded-lg border-2 border-gray-200 px-3 py-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{t.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setAddingTo(addingTo === t.id ? null : t.id);
                    setSearch("");
                  }}
                  className="text-sm text-[var(--color-primary)] font-medium"
                >
                  {addingTo === t.id ? "Done" : "+ Add person"}
                </button>
              </div>
              {t.people.length === 0 ? (
                <p className="text-sm text-gray-500">No one yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {t.people.map((p) => (
                    <span
                      key={p.id}
                      className="flex items-center gap-1 rounded-full bg-[var(--color-secondary)] text-white pl-3 pr-1 py-1 text-sm"
                    >
                      {p.name}
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => run(() => setTaskPerson(lineupId, t.id, p.id, false))}
                        aria-label={`Remove ${p.name} from ${t.name}`}
                        className="p-1 rounded-full hover:bg-white/20"
                      >
                        <X className="w-3.5 h-3.5" aria-hidden />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {addingTo === t.id && (
                <div className="flex flex-col gap-2">
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Type a name"
                    autoFocus
                    className="border rounded-lg px-3 py-2 text-sm"
                  />
                  <div className="flex flex-wrap gap-2">
                    {matches
                      .filter((p) => !t.people.some((x) => x.id === p.id))
                      .map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          disabled={isPending}
                          onClick={() => run(() => setTaskPerson(lineupId, t.id, p.id, true), () => setSearch(""))}
                          className="rounded-lg border-2 border-gray-300 px-3 py-1.5 text-sm hover:border-[var(--color-primary)] disabled:opacity-60"
                        >
                          {p.name}
                          <span className="ml-1 text-xs text-gray-500">{ROLE_LABEL[p.role] ?? ""}</span>
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
