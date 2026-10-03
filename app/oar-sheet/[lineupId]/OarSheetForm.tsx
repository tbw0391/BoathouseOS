"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import {
  OAR_GROUP_LABELS,
  oarLabel,
  oarSetsFor,
  tapeSwatch,
  type OarSet,
  type TapeColor,
} from "@/lib/oarSheet";
import { unwrapIfResult } from "@/lib/userError";
import { setBoatOars, setTaskPerson } from "./actions";

export type BoatOars = {
  // The boat's set, or null when none is picked (or seats disagree, from
  // before sheets were one set per boat).
  oar: { color: string; rings: number } | null;
  // Other boats at this regatta with the same set.
  alsoIn: string[];
};

export type TaskRow = {
  id: string;
  name: string;
  people: { id: string; name: string }[];
};

const ROLE_LABEL: Record<string, string> = {
  rower: "Rower",
  coxswain: "Cox",
  parent: "Parent",
  coach: "Coach",
  admin: "Admin",
};

function Swatch({ hex, size = "w-4 h-4" }: { hex: string; size?: string }) {
  return (
    <span
      className={`inline-block ${size} rounded-full border border-gray-400 shrink-0`}
      style={{ backgroundColor: hex }}
      aria-hidden
    />
  );
}

export function OarSheetForm({
  lineupId,
  colors,
  maxRings,
  sets,
  boatGroup,
  oars,
  tasks,
  roster,
}: {
  lineupId: string;
  colors: TapeColor[];
  maxRings: number;
  sets: OarSet[];
  boatGroup: string | null;
  oars: BoatOars;
  tasks: TaskRow[];
  roster: { id: string; name: string; role: string }[];
}) {
  const [pickedColor, setPickedColor] = useState<string | null>(
    oars.oar?.color ?? null,
  );
  // Squads to show oar sets for; starts on this boat's squad.
  const usedGroups = Object.keys(OAR_GROUP_LABELS).filter((g) =>
    sets.some((s) => s.groups.includes(g)),
  );
  const [groups, setGroups] = useState<string[]>(
    boatGroup && usedGroups.includes(boatGroup) ? [boatGroup] : [],
  );
  const swatch = (c: string) => tapeSwatch(c, colors);
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

  const matches = search.trim()
    ? roster
        .filter((p) =>
          p.name.toLowerCase().includes(search.trim().toLowerCase()),
        )
        .slice(0, 12)
    : [];

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="font-semibold mb-1">Oars</h2>
        <p className="text-sm text-gray-500 mb-3">
          {sets.length > 0
            ? "Tap the club's oar set this boat is taking."
            : "Pick the tape color, then how many pieces of tape."}
        </p>

        <p className="text-sm mb-3">
          {oars.oar ? (
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Swatch hex={swatch(oars.oar.color)} />
              {oarLabel({ rings: oars.oar.rings, tape_color: oars.oar.color })}
            </span>
          ) : (
            <span className="text-gray-500">No oars picked yet.</span>
          )}
        </p>
        {oars.alsoIn.length > 0 && (
          <p className="text-xs text-amber-700 mb-3">
            Also picked for {oars.alsoIn.join(", ")}.
          </p>
        )}

        <div className="flex flex-col gap-3">
          {sets.length > 0 ? (
            <>
              {usedGroups.length > 1 && (
                <div
                  className="flex flex-wrap items-center gap-1.5"
                  aria-label="Show sets for"
                >
                  <span className="text-xs text-gray-500 mr-1">Show:</span>
                  <button
                    type="button"
                    onClick={() => setGroups([])}
                    aria-pressed={groups.length === 0}
                    className={`rounded-full border px-2.5 py-0.5 text-xs ${
                      groups.length === 0
                        ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                        : "border-gray-300 text-gray-600"
                    }`}
                  >
                    All
                  </button>
                  {usedGroups.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() =>
                        setGroups((cur) =>
                          cur.includes(g)
                            ? cur.filter((x) => x !== g)
                            : [...cur, g],
                        )
                      }
                      aria-pressed={groups.includes(g)}
                      className={`rounded-full border px-2.5 py-0.5 text-xs ${
                        groups.includes(g)
                          ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                          : "border-gray-300 text-gray-600"
                      }`}
                    >
                      {OAR_GROUP_LABELS[g]}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex flex-col gap-2" aria-label="Oar sets">
                {oarSetsFor(sets, groups).map((set) => {
                  const on =
                    oars.oar?.color === set.color &&
                    oars.oar.rings === set.rings;
                  return (
                    <button
                      key={set.id}
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        run(() =>
                          setBoatOars(lineupId, {
                            color: set.color,
                            rings: set.rings,
                          }),
                        )
                      }
                      aria-pressed={on}
                      className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-left text-sm disabled:opacity-60 ${
                        on
                          ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5 font-medium"
                          : "border-gray-300"
                      }`}
                    >
                      <span
                        className="flex items-center gap-0.5 shrink-0"
                        aria-hidden
                      >
                        {Array.from({ length: set.rings }, (_, i) => (
                          <Swatch
                            key={i}
                            hex={swatch(set.color)}
                            size="w-3 h-3"
                          />
                        ))}
                      </span>
                      <span className="font-medium">
                        {oarLabel({ rings: set.rings, tape_color: set.color })}
                      </span>
                      <span className="text-xs text-gray-500 truncate">
                        {[
                          set.groups.map((g) => OAR_GROUP_LABELS[g]).join(", "),
                          set.note,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </button>
                  );
                })}
                {oarSetsFor(sets, groups).length === 0 && (
                  <p className="text-sm text-gray-500">
                    No oar sets for that squad. Tap All to see every set.
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-wrap gap-2" aria-label="Tape color">
                {colors.map(({ name: c }) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setPickedColor(c)}
                    aria-pressed={pickedColor === c}
                    className={`flex items-center gap-1.5 rounded-lg border-2 px-3 py-1.5 text-sm ${
                      pickedColor === c
                        ? "border-[var(--color-primary)] font-medium"
                        : "border-gray-300"
                    }`}
                  >
                    <Swatch hex={swatch(c)} />
                    {c}
                  </button>
                ))}
              </div>
              {pickedColor && (
                <div
                  className="flex flex-wrap gap-2"
                  aria-label="Pieces of tape"
                >
                  {Array.from({ length: maxRings }, (_, i) => i + 1).map(
                    (n) => (
                      <button
                        key={n}
                        type="button"
                        disabled={isPending}
                        onClick={() =>
                          run(() =>
                            setBoatOars(lineupId, {
                              color: pickedColor,
                              rings: n,
                            }),
                          )
                        }
                        className={`w-11 h-11 rounded-lg border-2 text-sm font-medium disabled:opacity-60 ${
                          oars.oar?.color === pickedColor &&
                          oars.oar.rings === n
                            ? "border-[var(--color-primary)] bg-[var(--color-secondary)] text-white"
                            : "border-gray-300"
                        }`}
                      >
                        {n}
                      </button>
                    ),
                  )}
                </div>
              )}
            </>
          )}
          {oars.oar && (
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                run(
                  () => setBoatOars(lineupId, null),
                  () => setPickedColor(null),
                )
              }
              className="self-start text-sm text-gray-500 underline"
            >
              Clear
            </button>
          )}
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-1">Launch and Recovery</h2>
        <p className="text-sm text-gray-500 mb-3">
          Pick anyone on the roster. They get an alert.
        </p>
        {tasks.length === 0 && (
          <p className="text-sm text-gray-500">
            This boat has no Launch or Recovery task.
          </p>
        )}
        <div className="flex flex-col gap-3">
          {tasks.map((t) => (
            <div
              key={t.id}
              className="rounded-lg border-2 border-gray-200 px-3 py-3 flex flex-col gap-2"
            >
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
                        onClick={() =>
                          run(() => setTaskPerson(lineupId, t.id, p.id, false))
                        }
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
                          onClick={() =>
                            run(
                              () => setTaskPerson(lineupId, t.id, p.id, true),
                              () => setSearch(""),
                            )
                          }
                          className="rounded-lg border-2 border-gray-300 px-3 py-1.5 text-sm hover:border-[var(--color-primary)] disabled:opacity-60"
                        >
                          {p.name}
                          <span className="ml-1 text-xs text-gray-500">
                            {ROLE_LABEL[p.role] ?? ""}
                          </span>
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
