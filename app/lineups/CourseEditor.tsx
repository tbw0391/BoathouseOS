"use client";

import dynamic from "next/dynamic";
import { useState, useTransition } from "react";
import { markersAlongWater, saveCourse } from "./actions";
import { distanceM, parseDistances } from "@/lib/riverPath";
import { unwrap } from "@/lib/userError";
import {
  courseDistanceLabel,
  parseCoordinates,
  type CourseMarker,
  type LatLng,
} from "@/lib/course";

const CourseMap = dynamic(() => import("./CourseMap"), { ssr: false });

// What a tap, "I'm standing here" or typed coordinates will move: the start,
// the finish, or the marker at that many metres.
type Which = "start" | "finish" | number;

const same = (a: LatLng | null, b: LatLng | null) => a?.lat === b?.lat && a?.lng === b?.lng;
const sameMarkers = (a: CourseMarker[], b: CourseMarker[]) =>
  a.length === b.length && a.every((m, i) => m.m === b[i].m && same(m, b[i]));

export function CourseEditor({
  eventId,
  canManage,
  savedStart,
  savedFinish,
  savedMarkers = [],
  borrowedFrom,
  center,
}: {
  eventId: string;
  canManage: boolean;
  savedStart: LatLng | null;
  savedFinish: LatLng | null;
  savedMarkers?: CourseMarker[];
  // Set when this regatta has no course yet and one from an earlier regatta
  // at the same place is shown instead.
  borrowedFrom: string | null;
  center: LatLng;
}) {
  const [start, setStart] = useState(savedStart);
  const [finish, setFinish] = useState(savedFinish);
  const [markers, setMarkers] = useState<CourseMarker[]>(savedMarkers);
  const [distancesText, setDistancesText] = useState(
    savedMarkers.length ? savedMarkers.map((m) => m.m).join(" ") : "500 1000 2000 3000 4000"
  );
  const [findingWater, startFindingWater] = useTransition();
  const [newMarker, setNewMarker] = useState("");
  const [placing, setPlacing] = useState<Which | null>(null);
  const [typing, setTyping] = useState<Which | null>(null);
  const [typed, setTyped] = useState("");
  const [locating, setLocating] = useState<Which | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  const dirty =
    !same(start, savedStart) ||
    !same(finish, savedFinish) ||
    !sameMarkers(markers, savedMarkers) ||
    borrowedFrom != null;

  function put(which: Which, p: LatLng) {
    if (which === "start") setStart(p);
    else if (which === "finish") setFinish(p);
    else setMarkers((cur) => cur.map((m) => (m.m === which ? { ...m, ...p } : m)));
  }

  function place(p: LatLng) {
    if (placing !== null) put(placing, p);
    setPlacing(null);
    setMessage(null);
  }

  // A new marker goes on the straight line that many metres from the start
  // (halfway if that's past the finish), ready to tap into place.
  function addMarker() {
    const m = Math.round(Number(newMarker));
    if (!start || !finish) return setMessage("Set the start and finish first.");
    if (!Number.isFinite(m) || m <= 0) return setMessage("Enter how many metres from the start, e.g. 1000.");
    if (markers.some((x) => x.m === m)) return setMessage(`There's already a ${m} m marker.`);
    const length = distanceM(start, finish);
    const f = length > m ? m / length : 0.5;
    const p = { lat: start.lat + (finish.lat - start.lat) * f, lng: start.lng + (finish.lng - start.lng) * f };
    setMarkers((cur) => [...cur, { m, ...p }].sort((a, b) => a.m - b.m));
    setNewMarker("");
    setPlacing(m);
    setMessage(`Added ${m} m on the straight line. Now tap the map where it really is.`);
  }

  // Markers at each distance along the water between the pins (the river's
  // line from OpenStreetMap), or the straight line where there's no river.
  function placeAlongWater() {
    if (!start || !finish) return setMessage("Set the start and finish first.");
    const distances = parseDistances(distancesText);
    if (distances.length === 0) return setMessage("Enter the distances, e.g. 500 1000 2000 3000 4000.");
    if (markers.length && !confirm("Replace the markers you have with new ones?")) return;
    setMessage("Finding the river between your pins…");
    startFindingWater(async () => {
      try {
        const r = unwrap(await markersAlongWater(start, finish, distances));
        setMarkers(r.markers);
        const skipped = distances.filter((d) => !r.markers.some((m) => m.m === d));
        const len = r.lengthM >= 1000 ? `${(r.lengthM / 1000).toFixed(2)} km` : `${r.lengthM} m`;
        setMessage(
          (r.followsRiver
            ? `Placed along the river (${len} start to finish).`
            : r.lookupFailed
              ? `Couldn't reach the river map, so these are on the straight line (${len}).`
              : `No bend in the river here, so these are on the straight line (${len}).`) +
            (skipped.length ? ` Left out ${skipped.join(", ")} m: past the finish.` : "") +
            " Check them on the map, move any that are off, then Save course."
        );
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Couldn't place the markers.");
      }
    });
  }

  function placeAtMyLocation(which: Which) {
    setMessage(null);
    if (!navigator.geolocation) return setMessage("This phone can't share its location.");
    setLocating(which);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        put(which, p);
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
    put(which, p);
    setTyping(null);
    setTyped("");
    setMessage(null);
  }

  function save() {
    setMessage(null);
    startSave(async () => {
      try {
        await saveCourse(eventId, start, finish, start && finish ? markers : []);
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

      {canManage && start && finish && (
        <div className="flex flex-col gap-2 rounded-lg border-2 border-gray-200 p-3">
          <span className="text-sm font-medium">Markers along the course</span>
          <span className="text-xs text-gray-500">
            Pins like 500 / 1000 / 2000 m. &quot;Place along the water&quot; follows the river between your start and
            finish (straight where the river is). While a boat&apos;s phone is tracking on On the Water, Race Day shows
            when it passed each one.
          </span>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>Markers at</span>
            <input
              value={distancesText}
              onChange={(e) => setDistancesText(e.target.value)}
              className="flex-1 min-w-40 border rounded px-2 py-1"
              aria-label="Marker distances in metres"
            />
            <span>m</span>
            <button
              type="button"
              onClick={placeAlongWater}
              disabled={findingWater}
              className={button(false) + " disabled:opacity-50"}
            >
              {findingWater ? "Finding the river…" : "Place along the water"}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>Or add one at</span>
            <input
              value={newMarker}
              onChange={(e) => setNewMarker(e.target.value)}
              inputMode="numeric"
              placeholder="1000"
              className="w-20 border rounded px-2 py-1"
              aria-label="New marker distance in metres"
            />
            <span>m</span>
            <button type="button" onClick={addMarker} className={button(false)}>
              Add marker
            </button>
          </div>
          {markers.length > 0 && (
            <ul className="flex flex-col gap-2 mt-1">
              {markers.map((mk) => (
                <li key={mk.m} className="flex flex-wrap items-center gap-2">
                  <span className="w-16 text-sm font-medium">{mk.m} m</span>
                  <button
                    type="button"
                    onClick={() => setPlacing(placing === mk.m ? null : mk.m)}
                    className={button(placing === mk.m)}
                  >
                    {placing === mk.m ? "Now tap the map…" : "Tap on map"}
                  </button>
                  <button
                    type="button"
                    onClick={() => placeAtMyLocation(mk.m)}
                    disabled={locating !== null}
                    className={button(false) + " disabled:opacity-50"}
                  >
                    {locating === mk.m ? "Finding you…" : "I'm standing here"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMarkers((cur) => cur.filter((x) => x.m !== mk.m))}
                    className="text-sm text-gray-500 underline"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="rounded-lg overflow-hidden border-2 border-gray-200">
        <CourseMap
          start={start}
          finish={finish}
          center={start ?? finish ?? center}
          onTap={placing !== null ? place : null}
          markers={start && finish ? markers : []}
          activeMarker={typeof placing === "number" ? placing : null}
        />
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
        {start && finish && markers.length > 0 && (
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-amber-500" /> {markers.map((m) => `${m.m}`).join(" · ")} m
          </span>
        )}
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
