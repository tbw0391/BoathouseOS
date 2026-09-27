"use client";

import { useState, useTransition } from "react";
import { clearFoodList } from "./actions";

export function ClearFoodListButton({
  eventId,
  signupCount,
}: {
  eventId: string;
  signupCount: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function clear() {
    const signupNote =
      signupCount > 0
        ? ` ${signupCount} signup${signupCount === 1 ? "" : "s"} will be removed too.`
        : "";
    if (
      !window.confirm(
        `Clear this regatta's food list? Every item goes away.${signupNote} The regatta stays on the schedule.`
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await clearFoodList(eventId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={clear}
        disabled={isPending}
        className="self-start text-sm text-red-600 hover:underline disabled:opacity-50"
      >
        {isPending ? "Clearing..." : "Clear food list"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
