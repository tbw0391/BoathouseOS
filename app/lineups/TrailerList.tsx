"use client";

import { useState, useTransition } from "react";
import type { TrailerItem } from "@/lib/database.types";
import {
  TRAILER_KIND_LABELS,
  TRAILER_KIND_ORDER,
  TRAILER_PRESETS,
  packedCount,
  type TrailerKind,
  type TrailerLeg,
} from "@/lib/trailer";
import {
  addRacingBoats,
  addTrailerItems,
  copyLastTrailerList,
  removeTrailerItem,
  setTrailerItemPacked,
} from "./trailerActions";

const chip = (active: boolean) =>
  `rounded-lg border-2 px-3 py-1.5 text-sm font-medium ${
    active
      ? "border-[var(--color-primary)] bg-[var(--color-secondary)] text-white"
      : "border-gray-300 hover:border-[var(--color-primary)]"
  }`;

export function TrailerList({
  eventId,
  items,
  nameById,
  canManage,
}: {
  eventId: string;
  items: TrailerItem[];
  nameById: Record<string, string>;
  canManage: boolean;
}) {
  // Before race day it's packing to go; after, packing for home.
  const [leg, setLeg] = useState<TrailerLeg>(() =>
    items.length > 0 && packedCount(items, "out") === items.length ? "home" : "out"
  );
  const [editing, setEditing] = useState(items.length === 0 && canManage);
  const [newLabel, setNewLabel] = useState("");
  const [newKind, setNewKind] = useState<TrailerKind>("other");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run(fn: () => Promise<unknown>, done?: (r: unknown) => void) {
    setMessage(null);
    start(async () => {
      try {
        const r = await fn();
        done?.(r);
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function toggle(item: TrailerItem) {
    const packed = (leg === "out" ? item.packed_out_at : item.packed_home_at) != null;
    setBusyId(item.id);
    run(
      () => setTrailerItemPacked(eventId, item.id, leg, !packed),
      () => setBusyId(null)
    );
  }

  const have = new Set(items.map((i) => i.label.toLowerCase()));
  const done = packedCount(items, leg);

  return (
    <div className="flex flex-col gap-4 max-w-xl">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setLeg("out")} className={chip(leg === "out")}>
          Packing to go
        </button>
        <button type="button" onClick={() => setLeg("home")} className={chip(leg === "home")}>
          Packing for home
        </button>
        {canManage && (
          <button type="button" onClick={() => setEditing(!editing)} className={chip(editing)}>
            {editing ? "Done editing" : "Edit list"}
          </button>
        )}
      </div>

      {items.length > 0 && (
        <p className={`text-sm font-medium ${done === items.length ? "text-green-700" : "text-gray-700"}`}>
          {done === items.length ? "Everything's on the trailer." : `${done} of ${items.length} packed`}
        </p>
      )}

      {items.length === 0 && !canManage && (
        <p className="text-sm text-gray-500">The coaches haven&apos;t made a trailer list for this regatta yet.</p>
      )}

      {TRAILER_KIND_ORDER.map((kind) => {
        const group = items.filter((i) => i.kind === kind);
        if (group.length === 0) return null;
        return (
          <div key={kind}>
            <h3 className="text-sm font-semibold text-gray-600 mb-1">{TRAILER_KIND_LABELS[kind]}</h3>
            <ul className="flex flex-col gap-1">
              {group.map((item) => {
                const at = leg === "out" ? item.packed_out_at : item.packed_home_at;
                const by = leg === "out" ? item.packed_out_by : item.packed_home_by;
                return (
                  <li key={item.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggle(item)}
                      disabled={busyId === item.id}
                      className={`flex-1 flex items-center gap-3 text-left rounded-lg border-2 px-3 py-2 ${
                        at ? "border-green-600 bg-green-50" : "border-gray-200 bg-white"
                      } disabled:opacity-60`}
                    >
                      <span
                        className={`w-6 h-6 shrink-0 rounded border-2 flex items-center justify-center text-sm ${
                          at ? "border-green-600 bg-green-600 text-white" : "border-gray-400"
                        }`}
                      >
                        {at ? "✓" : ""}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className={`block ${at ? "text-gray-500" : ""}`}>{item.label}</span>
                        {at && by && <span className="block text-xs text-gray-500">{nameById[by] ?? "Someone"}</span>}
                      </span>
                    </button>
                    {editing && (
                      <button
                        type="button"
                        onClick={() => run(() => removeTrailerItem(eventId, item.id))}
                        className="text-sm text-gray-500 underline"
                        aria-label={`Remove ${item.label}`}
                      >
                        Remove
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      {editing && (
        <div className="flex flex-col gap-3 rounded-lg border-2 border-gray-200 p-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(
                  () => addRacingBoats(eventId),
                  (n) => setMessage(n ? `Added ${n}.` : "Every racing boat is already on the list.")
                )
              }
              className={chip(false)}
            >
              + Every boat racing, with oars
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(
                  () => copyLastTrailerList(eventId),
                  (n) => setMessage(n ? `Copied ${n} from the last regatta.` : "Nothing new to copy.")
                )
              }
              className={chip(false)}
            >
              Copy last regatta&apos;s list
            </button>
          </div>

          <div>
            <p className="text-sm text-gray-600 mb-1">Tap to add:</p>
            <div className="flex flex-wrap gap-2">
              {TRAILER_PRESETS.filter((p) => !have.has(p.label.toLowerCase())).map((p) => (
                <button
                  key={p.label}
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => addTrailerItems(eventId, [p]))}
                  className="rounded-full border border-gray-300 px-3 py-1 text-sm hover:border-[var(--color-primary)]"
                >
                  + {p.label}
                </button>
              ))}
            </div>
          </div>

          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newLabel.trim()) return;
              run(
                () => addTrailerItems(eventId, [{ label: newLabel, kind: newKind }]),
                () => setNewLabel("")
              );
            }}
          >
            <p className="text-sm text-gray-600">Something else:</p>
            <div className="flex flex-wrap gap-2">
              {TRAILER_KIND_ORDER.map((k) => (
                <button key={k} type="button" onClick={() => setNewKind(k)} className={chip(newKind === k)}>
                  {TRAILER_KIND_LABELS[k]}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                maxLength={80}
                placeholder="e.g. Spare fin, Launch keys"
                className="flex-1 min-w-0 border rounded px-3 py-2 text-sm"
              />
              <button type="submit" disabled={pending || !newLabel.trim()} className={chip(false) + " disabled:opacity-50"}>
                Add
              </button>
            </div>
          </form>
        </div>
      )}

      {message && <p className="text-sm text-gray-600">{message}</p>}
    </div>
  );
}
