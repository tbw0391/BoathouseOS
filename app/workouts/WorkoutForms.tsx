"use client";

import { useState, useTransition } from "react";
import { ERG_PIECES, tidyErgTime } from "@/lib/erg";
import { unwrap } from "@/lib/userError";
import { deleteWorkout, importConcept2, logWorkout } from "./actions";

const chip = (active: boolean) =>
  `rounded-lg border-2 px-3 py-1.5 text-sm font-medium ${
    active ? "border-[var(--color-primary)] bg-[var(--color-secondary)] text-white" : "border-gray-300 hover:border-[var(--color-primary)]"
  }`;

export function LogWorkoutForm({ profileId, today }: { profileId: string; today: string }) {
  const [open, setOpen] = useState(false);
  const [pieceIdx, setPieceIdx] = useState<number | "other">(0);
  const [otherName, setOtherName] = useState("");
  const [time, setTime] = useState("");
  const [meters, setMeters] = useState("");
  const [rate, setRate] = useState("");
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const preset = pieceIdx === "other" ? null : ERG_PIECES[pieceIdx];
  const timed = !!preset?.seconds; // 30 min: enter meters
  const fixedDistance = preset?.distance ?? null;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="self-start bg-[var(--color-primary)] text-white rounded px-4 py-2 font-medium">
        + Log a piece
      </button>
    );
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-lg border-2 border-gray-200 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        setMessage(null);
        start(async () => {
          try {
            unwrap(await logWorkout(profileId, {
              doneOn: date,
              piece: preset ? preset.label : otherName,
              distanceM: fixedDistance ?? (meters.trim() ? Number(meters.replace(/,/g, "")) : null),
              timeText: timed ? String(preset!.seconds! >= 3600 ? "1:00:00" : `${preset!.seconds! / 60}:00`) : time,
              strokeRate: rate.trim() ? Number(rate) : null,
              notes,
            }));
            setTime("");
            setMeters("");
            setRate("");
            setNotes("");
            setOpen(false);
          } catch (err) {
            setMessage(err instanceof Error ? err.message : "Couldn't save.");
          }
        });
      }}
    >
      <div className="flex flex-wrap gap-2">
        {ERG_PIECES.map((p, i) => (
          <button key={p.label} type="button" onClick={() => setPieceIdx(i)} className={chip(pieceIdx === i)}>
            {p.label}
          </button>
        ))}
        <button type="button" onClick={() => setPieceIdx("other")} className={chip(pieceIdx === "other")}>
          Other
        </button>
      </div>
      {pieceIdx === "other" && (
        <input value={otherName} onChange={(e) => setOtherName(e.target.value)} maxLength={60} placeholder="e.g. 4 x 1000m, 3 x 20 min" className="border rounded px-3 py-2 text-sm" />
      )}
      <div className="flex flex-wrap gap-3 text-sm">
        {!timed && (
          <label className="flex flex-col gap-1">
            Time
            <input
              value={time}
              onChange={(e) => setTime(e.target.value)}
              onBlur={() => setTime((t) => tidyErgTime(t))}
              placeholder="6.45.2"
              inputMode="decimal"
              className="w-28 border rounded px-2 py-1"
            />
          </label>
        )}
        {(timed || pieceIdx === "other") && (
          <label className="flex flex-col gap-1">
            Meters
            <input value={meters} onChange={(e) => setMeters(e.target.value)} placeholder="7512" inputMode="numeric" className="w-28 border rounded px-2 py-1" />
          </label>
        )}
        <label className="flex flex-col gap-1">
          Rate (s/m)
          <input value={rate} onChange={(e) => setRate(e.target.value)} placeholder="30" inputMode="numeric" className="w-20 border rounded px-2 py-1" />
        </label>
        <label className="flex flex-col gap-1">
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border rounded px-2 py-1" />
        </label>
      </div>
      <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder="Notes (optional)" className="border rounded px-3 py-2 text-sm" />
      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending} className="bg-[var(--color-primary)] text-white rounded px-4 py-2 font-medium disabled:opacity-50">
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm underline">
          Cancel
        </button>
      </div>
      {message && <p className="text-sm text-red-600">{message}</p>}
    </form>
  );
}

export function RemoveWorkoutButton({ workoutId }: { workoutId: string }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  if (!confirm) {
    return (
      <button type="button" onClick={() => setConfirm(true)} className="text-xs text-gray-400 hover:text-gray-700" aria-label="Remove workout">
        ✕
      </button>
    );
  }
  return (
    <span className="flex gap-1 text-xs">
      <button type="button" disabled={pending} onClick={() => start(() => deleteWorkout(workoutId))} className="text-red-700 underline">
        Remove
      </button>
      <button type="button" onClick={() => setConfirm(false)} className="underline">
        Keep
      </button>
    </span>
  );
}

export function ImportConcept2({ profileId }: { profileId: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <section className="flex flex-col gap-2 text-sm">
      <h2 className="text-lg font-semibold">Import from Concept2</h2>
      <p className="text-gray-600">
        On{" "}
        <a href="https://log.concept2.com/history" target="_blank" rel="noreferrer" className="underline">
          log.concept2.com
        </a>
        , open History and export this season as a CSV file, then pick it here. Pieces already imported are skipped.
      </p>
      <input
        type="file"
        accept=".csv,text/csv"
        disabled={pending}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setMessage(null);
          start(async () => {
            try {
              const r = await importConcept2(profileId, await file.text());
              setMessage(`Added ${r.added} piece${r.added === 1 ? "" : "s"}${r.skipped ? `, skipped ${r.skipped} already here` : ""}.`);
            } catch (err) {
              setMessage(err instanceof Error ? err.message : "Couldn't import that file.");
            }
          });
        }}
        className="text-sm"
      />
      {pending && <p className="text-gray-600">Importing…</p>}
      {message && <p className="text-gray-700">{message}</p>}
    </section>
  );
}
