"use client";

import { unwrapIfResult } from "@/lib/userError";
import { useState, useTransition } from "react";
import { PRACTICE_CALL_LABELS, WIND_DIRECTIONS, type WaterSettings } from "@/lib/waterConditions";
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

export type CallDefaults = {
  waterTempF: number | null;
  airTempF: number | null;
  windMph: number | null;
  windDir: string | null;
};

// Today's go/no-go and the conditions the coach saw (0111). Prefilled from
// today's call if there is one, else the live readings; coaches adjust.
export function PracticeCallForm({
  current,
  currentNote,
  defaults,
  startOpen = false,
}: {
  current: string | null;
  currentNote: string;
  defaults: CallDefaults;
  startOpen?: boolean;
}) {
  const { error, pending, run } = useRunner();
  const [status, setStatus] = useState(current ?? "go");
  const [note, setNote] = useState(currentNote);
  const str = (v: number | null) => (v != null ? String(Math.round(v)) : "");
  const [waterTemp, setWaterTemp] = useState(str(defaults.waterTempF));
  const [airTemp, setAirTemp] = useState(str(defaults.airTempF));
  const [wind, setWind] = useState(str(defaults.windMph));
  const [windDir, setWindDir] = useState<string | null>(defaults.windDir);
  const [open, setOpen] = useState(startOpen);
  const num = (v: string) => (v.trim() ? Number(v) : null);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={chip(false) + " self-start"}>
        {current ? "Change today's call" : "Make today's call"}
      </button>
    );
  }

  const numberField = (label: string, value: string, set: (v: string) => void, unit: string) => (
    <label className="flex items-center justify-between gap-2 text-sm">
      {label}
      <span className="flex items-center gap-1">
        <input
          value={value}
          onChange={(e) => set(e.target.value)}
          inputMode="decimal"
          className="w-20 border rounded px-2 py-1 text-right"
        />
        <span className="w-8 text-gray-500">{unit}</span>
      </span>
    </label>
  );

  return (
    <form
      id="call"
      className="flex flex-col gap-3 rounded-lg border-2 border-gray-200 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () =>
            makePracticeCall(status, note, {
              waterTempF: num(waterTemp),
              airTempF: num(airTemp),
              windMph: num(wind),
              windDir,
            }),
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

      <div className="flex flex-col gap-2 max-w-xs">
        {numberField("Water temp", waterTemp, setWaterTemp, "°F")}
        {numberField("Air temp", airTemp, setAirTemp, "°F")}
        {numberField("Wind speed", wind, setWind, "mph")}
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm">Wind from</span>
        <div className="flex flex-wrap gap-1">
          {WIND_DIRECTIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setWindDir(windDir === d ? null : d)}
              className={`${chip(windDir === d)} w-12 px-0`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={300}
        rows={2}
        placeholder="Optional note: meet at the erg room at 4:15, launch shadows every crew…"
        className="border rounded px-3 py-2 text-sm"
      />
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
  const [open, setOpen] = useState(!settings.gaugeSite && settings.weatherLat == null);
  const [saved, setSaved] = useState(false);

  return (
    <section className="flex flex-col gap-2">
      <button type="button" onClick={() => setOpen(!open)} className="text-left text-lg font-semibold">
        Gauge, weather location and limits {open ? "▾" : "▸"}
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
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-gray-600">
              Weather location: where air temperature, wind and gusts are read (the nearest National Weather Service
              station to it). Blank: the gauge&apos;s location. On a regatta day the regatta&apos;s course is used.
            </span>
            <input
              name="weatherName"
              defaultValue={settings.weatherName ?? ""}
              placeholder="Name, e.g. Hoover Reservoir"
              maxLength={80}
              className="border rounded px-2 py-1"
            />
            <input
              name="weatherPoint"
              defaultValue={
                settings.weatherLat != null && settings.weatherLon != null
                  ? `${settings.weatherLat}, ${settings.weatherLon}`
                  : ""
              }
              placeholder="Coordinates, e.g. 40.1150, -82.8800"
              className="border rounded px-2 py-1"
            />
          </div>
          <div className="flex flex-col gap-1 text-sm">
            <label className="flex items-center gap-2 font-medium">
              <input type="checkbox" name="lightningAuto" defaultChecked={settings.lightningAuto} />
              Automatic lightning warning
            </label>
            <span className="text-gray-600">
              Lightning seen by NOAA&apos;s weather satellite within this distance of the weather location starts a
              lightning hold and alerts everyone, 5 AM to 9 PM. It clears itself after 30 minutes with no more
              lightning, or a coach can clear it.
            </span>
            <label className="flex items-center gap-2">
              <input
                name="lightningMiles"
                type="number"
                min={1}
                max={50}
                defaultValue={settings.lightningMiles}
                className="w-20 border rounded px-2 py-1"
              />
              miles
            </label>
          </div>
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
