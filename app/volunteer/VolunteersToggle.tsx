"use client";

import { useState, useTransition } from "react";
import { setHasVolunteers } from "./actions";
import { unwrap } from "@/lib/userError";

// "No volunteers at this regatta" switch for tent leaders, coaches, admins.
export function VolunteersToggle({ eventId, hasVolunteers }: { eventId: string; hasVolunteers: boolean }) {
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
              unwrap(await setHasVolunteers(eventId, !hasVolunteers));
            } catch (e) {
              setError(e instanceof Error ? e.message : "Something went wrong.");
            }
          });
        }}
        className="text-xs border rounded px-2 py-1 disabled:opacity-50"
      >
        {pending ? "Saving…" : hasVolunteers ? "No volunteers at this regatta" : "We need volunteers after all"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
