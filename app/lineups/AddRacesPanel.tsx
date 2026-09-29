"use client";

import { useState, useTransition } from "react";
import { addPastedRaces } from "./actions";
import { addAllRegattaRaces } from "@/app/regatta/actions";
import { ImportRacesForm } from "./ImportRacesForm";
import { CreateLineupForm } from "./CreateLineupForm";
import { CrewTimerImport } from "./CrewTimerImport";
import type { Boat } from "@/lib/database.types";
import { unwrap } from "@/lib/userError";

type Tab = "feed" | "crewtimer" | "paste" | "excel" | "boat";

// The one place a coach adds races to a regatta. Whatever the source, races
// land the same way (lib/raceWorkflow.ts insertRaces): duplicates skipped,
// Launch/Recovery tasks made, and the boat filled in when only one fits.
export function AddRacesPanel({
  eventId,
  boats,
  hasResultsFeed,
  crewTimerName,
  pendingStarredLines,
}: {
  eventId: string;
  boats: Boat[];
  hasResultsFeed: boolean;
  crewTimerName: string | null;
  pendingStarredLines: string[];
}) {
  const tabs: { id: Tab; label: string }[] = [
    ...(hasResultsFeed ? [{ id: "feed" as const, label: "Results feed" }] : []),
    { id: "crewtimer", label: "From CrewTimer" },
    { id: "paste", label: "Paste a list" },
    { id: "excel", label: "Excel" },
    { id: "boat", label: "One boat" },
  ];
  const [tab, setTab] = useState<Tab>(hasResultsFeed ? "feed" : "paste");
  const [text, setText] = useState(pendingStarredLines.join("\n"));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<void>) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        await action();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="border rounded-lg p-4 flex flex-col gap-3">
      <h2 className="font-medium">Add races</h2>

      <div className="flex flex-wrap gap-2" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => {
              setTab(t.id);
              setError(null);
              setMessage(null);
            }}
            className={`rounded-lg border-2 px-3 py-1.5 text-sm font-medium ${
              tab === t.id
                ? "border-[var(--color-primary)] bg-[var(--color-secondary)] text-white"
                : "border-gray-300 hover:border-[var(--color-primary)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "feed" && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-gray-500">
            Adds every one of your club&apos;s races that hasn&apos;t finished yet, straight from the live
            results. Tap again later to pick up new entries.
          </p>
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(() => addAllRegattaRaces())}
            className="self-start bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] rounded px-3 py-2 text-sm disabled:opacity-50"
          >
            {isPending ? "Adding..." : "Add all races from the results"}
          </button>
        </div>
      )}

      {tab === "paste" && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-gray-500">
            One race per line. Put the time first if you have it, like &quot;9:15 AM Men&apos;s Masters
            8+&quot;.
            {pendingStarredLines.length > 0 && " Your ★ races from the schedule are filled in below."}
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder={"9:15 AM Men's Masters 8+\n10:40 AM Women's Youth 4+"}
            className="border rounded px-3 py-2 text-sm font-mono"
          />
          <button
            type="button"
            disabled={isPending || !text.trim()}
            onClick={() =>
              run(async () => {
                const res = unwrap(await addPastedRaces(eventId, text));
                setText("");
                setMessage(
                  `Added ${res.imported} race${res.imported === 1 ? "" : "s"}` +
                    (res.skipped > 0 ? ` (${res.skipped} already on this regatta).` : ".")
                );
              })
            }
            className="self-start bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] rounded px-3 py-2 text-sm disabled:opacity-50"
          >
            {isPending ? "Adding..." : "Add races"}
          </button>
        </div>
      )}

      {tab === "crewtimer" && <CrewTimerImport eventId={eventId} defaultCrewName={crewTimerName} />}

      {tab === "excel" && <ImportRacesForm eventId={eventId} />}

      {tab === "boat" && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-gray-500">
            For a boat that isn&apos;t tied to a listed race, like a practice piece or scrimmage.
          </p>
          <CreateLineupForm eventId={eventId} boats={boats} />
        </div>
      )}

      {message && <p className="text-sm text-green-700">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
