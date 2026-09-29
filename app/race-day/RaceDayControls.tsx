"use client";

import { useState, useTransition } from "react";
import { DELAY_MINUTE_OPTIONS, LAUNCH_MINUTE_OPTIONS, RACE_SOON_MINUTES } from "@/lib/raceDay";
import { saveBowNumber, saveLaunchMinutes, saveRaceDelay, sendRaceSoon } from "./actions";
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

// Coaches: how late the regatta is running. Everyone's race and launch times
// on this page move with it, and the crews still to race get an alert.
export function RaceDelayPicker({ eventId, current }: { eventId: string; current: number }) {
  const [pending, setPending] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startSave] = useTransition();
  return (
    <div className="mb-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-gray-600">Running late:</span>
        {DELAY_MINUTE_OPTIONS.map((m) => (
          <button
            key={m}
            type="button"
            disabled={pending !== null}
            onClick={() => {
              setPending(m);
              setError(null);
              startSave(async () => {
                const result = await saveRaceDelay(eventId, m);
                if (!result.ok) setError(result.error);
                setPending(null);
              });
            }}
            className={`rounded-lg border-2 px-2 py-1 ${
              m === current
                ? "border-[var(--color-primary)] bg-[var(--color-secondary)] text-white"
                : "border-gray-300 hover:border-[var(--color-primary)]"
            } disabled:opacity-60`}
          >
            {pending === m ? "…" : m === 0 ? "On time" : `+${m} min`}
          </button>
        ))}
      </div>
      {error && <p className="mt-1 text-red-600">{error}</p>}
    </div>
  );
}

// Coaches: "racing in about 20 minutes" to this crew and their parents.
export function RaceSoonButton({ lineupId, sentAt }: { lineupId: string; sentAt: string | null }) {
  const [sent, setSent] = useState(!!sentAt);
  const [error, setError] = useState<string | null>(null);
  const [sending, startSend] = useTransition();

  if (sent) {
    return (
      <span className="text-xs font-medium rounded-full bg-green-100 text-green-800 px-2 py-0.5">
        {RACE_SOON_MINUTES}-min alert sent
      </span>
    );
  }
  return (
    <>
      <button
        type="button"
        disabled={sending}
        onClick={() => {
          setError(null);
          startSend(async () => {
            const result = await sendRaceSoon(lineupId);
            if (result.ok) setSent(true);
            else setError(result.error);
          });
        }}
        className="text-xs font-medium rounded-full bg-amber-100 hover:bg-amber-200 text-amber-900 px-2 py-0.5 disabled:opacity-60"
      >
        {sending ? "Sending…" : `Send "racing in ${RACE_SOON_MINUTES} min"`}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </>
  );
}
