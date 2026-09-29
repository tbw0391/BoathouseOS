"use client";

import { useState, useTransition } from "react";
import { LAUNCH_MINUTE_OPTIONS } from "@/lib/raceDay";
import { saveBowNumber, saveLaunchMinutes } from "./actions";
import { unwrap } from "@/lib/userError";

export function BowNumberEditor({ lineupId, current }: { lineupId: string; current: string | null }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(current ?? "");
  const [saving, startSave] = useTransition();

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-xs font-medium rounded-full bg-gray-100 hover:bg-gray-200 px-2 py-0.5"
      >
        {current ? `Bow #${current}` : "+ Bow number"}
      </button>
    );
  }

  return (
    <form
      className="flex items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        startSave(async () => {
          await saveBowNumber(lineupId, value);
          setEditing(false);
        });
      }}
    >
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={10}
        inputMode="numeric"
        placeholder="Bow #"
        className="w-20 border rounded px-2 py-0.5 text-sm"
      />
      <button type="submit" disabled={saving} className="text-xs underline disabled:opacity-50">
        {saving ? "Saving…" : "Save"}
      </button>
      <button type="button" onClick={() => setEditing(false)} className="text-xs text-gray-500 underline">
        Cancel
      </button>
    </form>
  );
}

export function LaunchMinutesPicker({ current }: { current: number }) {
  const [pending, setPending] = useState<number | null>(null);
  const [, startSave] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4 text-sm">
      <span className="text-gray-600">Launch this long before:</span>
      {LAUNCH_MINUTE_OPTIONS.map((m) => (
        <button
          key={m}
          type="button"
          disabled={pending !== null}
          onClick={() => {
            setPending(m);
            startSave(async () => {
              unwrap(await saveLaunchMinutes(m));
              setPending(null);
            });
          }}
          className={`rounded-lg border-2 px-2 py-1 ${
            m === current
              ? "border-[var(--color-primary)] bg-[var(--color-secondary)] text-white"
              : "border-gray-300 hover:border-[var(--color-primary)]"
          } disabled:opacity-60`}
        >
          {pending === m ? "…" : `${m} min`}
        </button>
      ))}
    </div>
  );
}
