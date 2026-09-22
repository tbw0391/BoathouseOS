"use client";

import { useState, useTransition } from "react";
import { publishFoodList } from "./actions";

export function PublishControl({ eventId }: { eventId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function publish() {
    if (
      !window.confirm(
        "Publish this food list? Parents will be able to see and sign up for these items."
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await publishFoodList(eventId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={publish}
        disabled={isPending}
        className="self-start text-sm bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] rounded px-3 py-2 disabled:opacity-50"
      >
        {isPending ? "Publishing..." : "Confirm & publish to parents"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
