"use client";

import { useEffect, useState, useTransition } from "react";
import { addCrewTimerRaces, findCrewTimerRaces, type CrewTimerRaceOption } from "./actions";

const NAME_KEY = "crewtimer-crew-name";

// "From CrewTimer" on a regatta: paste its CrewTimer link, find your club's
// entries, tap the ones to add.
export function CrewTimerImport({ eventId, defaultCrewName }: { eventId: string; defaultCrewName: string | null }) {
  const [link, setLink] = useState("");
  const [crewName, setCrewName] = useState(defaultCrewName ?? "");
  const [races, setRaces] = useState<CrewTimerRaceOption[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [crewNames, setCrewNames] = useState<string[]>([]);
  const [crewFilter, setCrewFilter] = useState("");
  const [heading, setHeading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (defaultCrewName) return;
    try {
      const saved = localStorage.getItem(NAME_KEY);
      if (saved) setCrewName(saved);
    } catch {}
  }, [defaultCrewName]);

  function find(name = crewName) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await findCrewTimerRaces(eventId, link, name);
        setHeading(res.title);
        setRaces(res.races);
        setCrewNames(res.crewNames);
        setPicked(new Set(res.races.filter((r) => !r.alreadyAdded).map((r) => r.key)));
        if (res.races.length > 0) {
          try {
            localStorage.setItem(NAME_KEY, name);
          } catch {}
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function pickCrew(name: string) {
    setCrewName(name);
    setCrewFilter("");
    find(name);
  }

  function toggle(key: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function add() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await addCrewTimerRaces(eventId, link, crewName, [...picked]);
        setMessage(
          `Added ${res.imported} race${res.imported === 1 ? "" : "s"}` +
            (res.skipped > 0 ? ` (${res.skipped} already on this regatta).` : ".")
        );
        setRaces(null);
        setPicked(new Set());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  const filteredCrews = crewFilter.trim()
    ? crewNames.filter((n) => n.toLowerCase().includes(crewFilter.trim().toLowerCase()))
    : crewNames;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-gray-500">
        Paste the regatta&apos;s CrewTimer link. The race schedule is usually posted there a few days
        before race day.
      </p>
      <input
        value={link}
        onChange={(e) => setLink(e.target.value)}
        placeholder="crewtimer.com/regatta/r16268"
        className="border rounded px-3 py-2 text-sm"
      />
      <input
        value={crewName}
        onChange={(e) => setCrewName(e.target.value)}
        placeholder="Your club's name on CrewTimer"
        className="border rounded px-3 py-2 text-sm"
      />
      <button
        type="button"
        disabled={isPending || !link.trim() || !crewName.trim()}
        onClick={() => find()}
        className="self-start bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] rounded px-3 py-2 text-sm disabled:opacity-50"
      >
        {isPending && !races ? "Looking..." : "Find our races"}
      </button>

      {races && races.length === 0 && crewNames.length > 0 && (
        <div className="flex flex-col gap-2 mt-2">
          <p className="text-sm">
            No entries for &quot;{crewName}&quot;{heading ? ` in ${heading}` : ""}. Tap your club:
          </p>
          <input
            value={crewFilter}
            onChange={(e) => setCrewFilter(e.target.value)}
            placeholder="Search clubs"
            className="border rounded px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto">
            {filteredCrews.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => pickCrew(name)}
                className="rounded-full border-2 border-gray-300 hover:border-[var(--color-primary)] px-3 py-1 text-sm"
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {races && races.length > 0 && (
        <div className="flex flex-col gap-2 mt-2">
          <p className="text-sm">
            {races.length} race{races.length === 1 ? "" : "s"} for {crewName}
            {heading ? ` in ${heading}` : ""}. Tap to include or skip:
          </p>
          <div className="flex flex-col gap-1.5">
            {races.map((r) => {
              const on = picked.has(r.key);
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => toggle(r.key)}
                  aria-pressed={on}
                  className={`flex items-center justify-between gap-2 rounded-lg border-2 px-3 py-2 text-left text-sm ${
                    on ? "border-[var(--color-primary)] bg-[var(--color-secondary)] text-white" : "border-gray-300"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{r.raceName}</span>
                    <span className="block text-xs opacity-75">
                      {[r.startLabel, r.crew, r.alreadyAdded ? "already added" : null].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span aria-hidden>{on ? "✓" : ""}</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={isPending || picked.size === 0}
            onClick={add}
            className="self-start bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] rounded px-3 py-2 text-sm disabled:opacity-50"
          >
            {isPending ? "Adding..." : `Add ${picked.size} race${picked.size === 1 ? "" : "s"}`}
          </button>
        </div>
      )}

      {message && <p className="text-sm text-green-700">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
