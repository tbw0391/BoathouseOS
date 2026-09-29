"use client";

import { unwrapIfResult } from "@/lib/userError";
import { useState, useTransition } from "react";
import { PRACTICE_CALL_LABELS, type WaterSettings } from "@/lib/waterConditions";
import { clearLightningHold, makePracticeCall, saveWaterSettings, startLightningHold, strikeAgain } from "./actions";

const chip = (active: boolean) =>
  `rounded-lg border-2 px-3 py-2 text-sm font-medium ${
    active
      ? "border-[var(--color-primary)] bg-[var(--color-secondary)] text-white"
      : "border-gray-300 hover:border-[var(--color-primary)]"
  }`;

function useRunner() {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>, after?: () => void) => {
    setError(null);
    start(async () => {
      try {
        unwrapIfResult(await fn());
        after?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  };
  return { error, pending, run };
}

export function LightningControls({ active }: { active: boolean }) {
  const { error, pending, run } = useRunner();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {!active ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(startLightningHold)}
            className="rounded-lg bg-red-700 text-white px-4 py-3 font-semibold disabled:opacity-50"
          >
            ⚡ Lightning: everyone off the water
          </button>
        ) : (
          <>
            <button type="button" disabled={pending} onClick={() => run(strikeAgain)} className="rounded-lg border-2 border-red-700 text-red-700 px-4 py-2 font-medium disabled:opacity-50">
              Heard thunder again (restart 30 min)
            </button>
            <button type="button" disabled={pending} onClick={() => run(clearLightningHold)} className="rounded-lg bg-green-700 text-white px-4 py-2 font-medium disabled:opacity-50">
              All clear
            </button>
          </>
        )}
      </div>
      {!active && <p className="text-xs text-gray-500">Sends an alert to everyone in the club.</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function PracticeCallForm({
  current,
  currentNote,
  needsWaterTemp,
  currentWaterTemp,
}: {
  current: string | null;
  currentNote: string;
  needsWaterTemp: boolean;
  currentWaterTemp: number | null;
}) {
  const { error, pending, run } = useRunner();
  const [status, setStatus] = useState(current ?? "go");
  const [note, setNote] = useState(currentNote);
  const [waterTemp, setWaterTemp] = useState(currentWaterTemp != null ? String(currentWaterTemp) : "");
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={chip(false) + " self-start"}>
        {current ? "Change today's call" : "Make today's call"}
      </button>
    );
  }

  return (
    <form
      className="flex flex-col gap-2 rounded-lg border-2 border-gray-200 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => makePracticeCall(status, note, waterTemp.trim() ? Number(waterTemp) : null),
          () => setOpen(false)
        );
      }}
    >
      <div className="flex flex-wrap gap-2">
        {Object.entries(PRACTICE_CALL_LABELS).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setStatus(key)} className={chip(status === key)}>
            {label}
          </button>
        ))}
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={300}
        rows={2}
        placeholder="Optional note: meet at the erg room at 4:15, launch shadows every crew…"
        className="border rounded px-3 py-2 text-sm"
      />
      {needsWaterTemp && (
        <label className="flex items-center gap-2 text-sm">
          Water temp measured at the dock
          <input
            value={waterTemp}
            onChange={(e) => setWaterTemp(e.target.value)}
            inputMode="decimal"
            placeholder="°F"
            className="w-20 border rounded px-2 py-1"
          />
          °F
        </label>
      )}
      <div className="flex gap-2 items-center">
        <button type="submit" disabled={pending} className="bg-[var(--color-primary)] text-white rounded px-4 py-2 font-medium disabled:opacity-50">
          {pending ? "Sending…" : "Send to everyone"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm underline">
          Cancel
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}

function Field({ name, label, value, unit }: { name: keyof WaterSettings; label: string; value: number | null; unit: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-gray-600">{label}</span>
      <span className="flex items-center gap-1">
        <input name={name} defaultValue={value ?? ""} inputMode="decimal" className="w-24 border rounded px-2 py-1" />
        <span className="text-gray-500">{unit}</span>
      </span>
    </label>
  );
}

export function WaterSettingsForm({ settings }: { settings: WaterSettings }) {
  const { error, pending, run } = useRunner();
  const [open, setOpen] = useState(!settings.gaugeSite);
  const [saved, setSaved] = useState(false);

  return (
    <section className="flex flex-col gap-2">
      <button type="button" onClick={() => setOpen(!open)} className="text-left text-lg font-semibold">
        Gauge and limits {open ? "▾" : "▸"}
      </button>
      {open && (
        <form
          className="flex flex-col gap-3 rounded-lg border-2 border-gray-200 p-3"
          action={(fd) => run(() => saveWaterSettings(fd), () => setSaved(true))}
        >
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-600">
              USGS river gauge number, from{" "}
              <a href="https://waterdata.usgs.gov/nwis/rt" target="_blank" rel="noreferrer" className="underline">
                waterdata.usgs.gov
              </a>{" "}
              (e.g. 03049500, Allegheny River at Natrona)
            </span>
            <input name="gaugeSite" defaultValue={settings.gaugeSite ?? ""} inputMode="numeric" className="w-40 border rounded px-2 py-1" />
          </label>
          <p className="text-sm text-gray-600">Leave a limit blank to skip it. Caution turns the verdict yellow; stop turns it red.</p>
          <div className="grid grid-cols-2 gap-3">
            <Field name="flowCautionCfs" label="Flow: caution at" value={settings.flowCautionCfs} unit="cfs" />
            <Field name="flowStopCfs" label="Flow: stop at" value={settings.flowStopCfs} unit="cfs" />
            <Field name="heightCautionFt" label="Level: caution at" value={settings.heightCautionFt} unit="ft" />
            <Field name="heightStopFt" label="Level: stop at" value={settings.heightStopFt} unit="ft" />
            <Field name="windCautionMph" label="Wind: caution at" value={settings.windCautionMph} unit="mph" />
            <Field name="windStopMph" label="Wind: stop at" value={settings.windStopMph} unit="mph" />
            <Field name="combinedCautionF" label="Air + water: caution below" value={settings.combinedCautionF} unit="°F" />
            <Field name="combinedStopF" label="Air + water: stop below" value={settings.combinedStopF} unit="°F" />
          </div>
          <div className="flex items-center gap-2">
            <button type="submit" disabled={pending} className="bg-[var(--color-primary)] text-white rounded px-4 py-2 font-medium disabled:opacity-50">
              Save
            </button>
            {saved && !error && <span className="text-sm text-gray-600">Saved.</span>}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      )}
    </section>
  );
}
