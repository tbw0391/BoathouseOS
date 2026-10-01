"use client";

import { useState, useTransition } from "react";
import { setHasFoodTent } from "./actions";
import { unwrap } from "@/lib/userError";

// "No food tent at this regatta" switch for tent leaders, coaches, admins.
export function FoodTentToggle({ eventId, hasFoodTent }: { eventId: string; hasFoodTent: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          start(async () => {
            try {
              unwrap(await setHasFoodTent(eventId, !hasFoodTent));
            } catch (e) {
              setError(e instanceof Error ? e.message : "Something went wrong.");
            }
          });
        }}
        className="text-xs border rounded px-2 py-1 disabled:opacity-50"
      >
        {pending ? "Saving…" : hasFoodTent ? "No food tent at this regatta" : "We have a food tent after all"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
