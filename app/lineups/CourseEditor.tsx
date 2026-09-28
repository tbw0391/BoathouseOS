"use client";

import dynamic from "next/dynamic";
import { useState, useTransition } from "react";
import { saveCourse } from "./actions";
import { courseDistanceLabel, parseCoordinates, type LatLng } from "@/lib/course";

const CourseMap = dynamic(() => import("./CourseMap"), { ssr: false });

type Which = "start" | "finish";

const same = (a: LatLng | null, b: LatLng | null) => a?.lat === b?.lat && a?.lng === b?.lng;

export function CourseEditor({
  eventId,
  canManage,
  savedStart,
  savedFinish,
  borrowedFrom,
  center,
}: {
  eventId: string;
  canManage: boolean;
  savedStart: LatLng | null;
  savedFinish: LatLng | null;
  // Set when this regatta has no course yet and one from an earlier regatta
  // at the same place is shown instead.
  borrowedFrom: string | null;
  center: LatLng;
}) {
  const [start, setStart] = useState(savedStart);
  const [finish, setFinish] = useState(savedFinish);
  const [placing, setPlacing] = useState<Which | null>(null);
  const [typing, setTyping] = useState<Which | null>(null);
  const [typed, setTyped] = useState("");
  const [locating, setLocating] = useState<Which | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  const dirty = !same(start, savedStart) || !same(finish, savedFinish) || borrowedFrom != null;

  function place(p: LatLng) {
    if (placing === "start") setStart(p);
    if (placing === "finish") setFinish(p);
    setPlacing(null);
    setMessage(null);
  }

  function placeAtMyLocation(which: Which) {
    setMessage(null);
    if (!navigator.geolocation) return setMessage("This phone can't share its location.");
    setLocating(which);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (which === "start") setStart(p);
        else setFinish(p);
        setLocating(null);
        if (pos.coords.accuracy > 50) {
          setMessage(`Only accurate to about ${Math.round(pos.coords.accuracy)} m. Drag the map and tap to fine-tune.`);
        }
      },
      () => {
        setLocating(null);
        setMessage("Couldn't get your location. Check that location is allowed for this site.");
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  function applyTyped(which: Which) {
    const p = parseCoordinates(typed);
    if (!p) return setMessage("Couldn't read those coordinates. Use a form like 40.4468, -80.0123.");
    if (which === "start") setStart(p);
    else setFinish(p);
    setTyping(null);
    setTyped("");
    setMessage(null);
  }

  function save() {
    setMessage(null);
    startSave(async () => {
      try {
        await saveCourse(eventId, start, finish);
        setMessage("Saved.");
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Couldn't save.");
      }
    });
  }

  if (!canManage && !start && !finish) {
    return <p className="text-sm text-gray-500">The start and finish haven&apos;t been marked yet.</p>;
  }

  const button = (active: boolean) =>
    `rounded-lg border-2 px-3 py-2 text-sm font-medium ${
      active
        ? "border-[var(--color-primary)] bg-[var(--color-secondary)] text-white"
        : "border-gray-300 hover:border-[var(--color-primary)]"
    }`;

  return (
    <div className="flex flex-col gap-3 max-w-3xl">
      {borrowedFrom && (
        <p className="text-sm text-amber-700">
          Showing the course from {borrowedFrom}, at the same place.
          {canManage && " Save to use it for this regatta too, or move the pins first."}
        </p>
      )}

      {canManage && (
        <div className="flex flex-col gap-2">
          {(["start", "finish"] as Which[]).map((which) => (
            <div key={which} className="flex flex-wrap items-center gap-2">
              <span className="w-14 text-sm font-medium">{which === "start" ? "Start" : "Finish"}</span>
              <button
                type="button"
                onClick={() => setPlacing(placing === which ? null : which)}
                className={button(placing === which)}
              >
                {placing === which ? "Now tap the map…" : "Tap on map"}
              </button>
              <button
                type="button"
                onClick={() => placeAtMyLocation(which)}
                disabled={locating !== null}
                className={button(false) + " disabled:opacity-50"}
              >
                {locating === which ? "Finding you…" : "I'm standing here"}
              </button>
              <button
                type="button"
                onClick={() => {
                  const p = which === "start" ? start : finish;
                  setTyping(typing === which ? null : which);
                  setTyped(p ? `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}` : "");
                }}
                className={button(typing === which)}
              >
                Type coordinates
              </button>
              {(which === "start" ? start : finish) && (
                <button
                  type="button"
                  onClick={() => (which === "start" ? setStart(null) : setFinish(null))}
                  className="text-sm text-gray-500 underline"
                >
                  Clear
                </button>
              )}
              {typing === which && (
                <form
                  className="w-full flex gap-2 sm:pl-16"
                  onSubmit={(e) => {
                    e.preventDefault();
                    applyTyped(which);
                  }}
                >
                  <input
                    autoFocus
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    placeholder="40.4468, -80.0123"
                    inputMode="decimal"
                    className="flex-1 min-w-0 border rounded px-3 py-2 text-sm"
                  />
                  <button type="submit" className={button(false)}>
                    Put pin here
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg overflow-hidden border-2 border-gray-200">
        <CourseMap start={start} finish={finish} center={start ?? finish ?? center} onTap={placing ? place : null} />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full bg-green-700" /> Start
          {start && <span className="text-gray-500">{start.lat.toFixed(5)}, {start.lng.toFixed(5)}</span>}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full bg-red-700" /> Finish
          {finish && <span className="text-gray-500">{finish.lat.toFixed(5)}, {finish.lng.toFixed(5)}</span>}
        </span>
        {start && finish && <span className="text-gray-600">{courseDistanceLabel(start, finish)} apart in a straight line</span>}
      </div>

      {canManage && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving || !dirty}
            className="bg-[var(--color-primary)] text-white rounded px-4 py-2 font-medium disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save course"}
          </button>
          {message && <span className="text-sm text-gray-600">{message}</span>}
        </div>
      )}
      {!canManage && message && <p className="text-sm text-gray-600">{message}</p>}
    </div>
  );
}
