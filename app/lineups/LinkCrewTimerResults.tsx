"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { linkCrewTimerResults } from "./actions";
import { unwrap } from "@/lib/userError";

// Results tab, for coaches: point this regatta at its CrewTimer results so
// places and times fill in live. Pre-filled with what's saved, if anything.
export function LinkCrewTimerResults({
  eventId,
  savedLink,
  savedCrew,
  defaultCrew,
}: {
  eventId: string;
  savedLink: string | null;
  savedCrew: string | null;
  defaultCrew: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(!savedLink);
  const [link, setLink] = useState(savedLink ?? "");
  const [crew, setCrew] = useState(savedCrew ?? defaultCrew);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="self-start text-xs text-gray-500 underline">
        Change CrewTimer link
      </button>
    );
  }

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        unwrap(await linkCrewTimerResults(eventId, link, crew));
        setOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border-2 border-gray-200 p-3">
      <p className="text-sm font-medium">Get live results from CrewTimer</p>
      <p className="text-xs text-gray-500">
        Paste the regatta&apos;s CrewTimer link. Places and times then show up here as boats finish.
      </p>
      <input
        value={link}
        onChange={(e) => setLink(e.target.value)}
        placeholder="crewtimer.com/regatta/r12345"
        inputMode="url"
        autoCapitalize="none"
        className="border rounded px-3 py-2 text-sm min-w-0"
      />
      <input
        value={crew}
        onChange={(e) => setCrew(e.target.value)}
        placeholder="Your club's name on CrewTimer"
        className="border rounded px-3 py-2 text-sm min-w-0"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={save}
        disabled={isPending || !link.trim() || !crew.trim()}
        className="self-start rounded-lg bg-[var(--color-secondary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? "Checking…" : "Show results"}
      </button>
    </div>
  );
}
