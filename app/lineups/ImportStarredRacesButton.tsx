"use client";

import { useState, useTransition } from "react";
import { createRacesFromDescription } from "./actions";

export function ImportStarredRacesButton({ eventId, count }: { eventId: string; count: number }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        await createRacesFromDescription(eventId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="mb-3">
      <button
        onClick={handleClick}
        disabled={isPending}
        className="text-sm border-2 border-[var(--color-primary)] rounded px-3 py-2 bg-yellow-50 disabled:opacity-50"
      >
        {isPending
          ? "Adding..."
          : `★ Add ${count} race${count === 1 ? "" : "s"} from the schedule`}
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
