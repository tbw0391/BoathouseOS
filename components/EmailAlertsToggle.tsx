"use client";

import { useState, useTransition } from "react";
import { Mail } from "lucide-react";
import { setEmailAlerts } from "@/app/notifications/actions";
import { unwrap } from "@/lib/userError";

// Beside the phone-alerts prompt on the home page: important alerts
// (lightning, practice calls, launch times, payments) are emailed when phone
// alerts are off.
export function EmailAlertsToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function set(next: boolean) {
    setError(null);
    setOn(next);
    start(async () => {
      try {
        unwrap(await setEmailAlerts(next));
      } catch (e) {
        setOn(!next);
        setError(e instanceof Error ? e.message : "Couldn't change email alerts.");
      }
    });
  }

  return (
    <div className="w-full flex flex-col gap-2 rounded-lg border-2 border-[var(--color-primary)] px-4 py-3 text-sm">
      <p className="flex items-center gap-2 font-medium">
        <Mail className="w-5 h-5 shrink-0" />
        {on
          ? "Important alerts are emailed to you when phone alerts are off."
          : "Email you important alerts when phone alerts are off?"}
      </p>
      <div className="flex gap-2">
        {on ? (
          <button
            type="button"
            onClick={() => set(false)}
            disabled={pending}
            className="rounded px-3 py-2 text-gray-500 hover:underline disabled:opacity-50"
          >
            Turn off emails
          </button>
        ) : (
          <button
            type="button"
            onClick={() => set(true)}
            disabled={pending}
            className="bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] rounded px-3 py-2 disabled:opacity-50"
          >
            {pending ? "Turning on..." : "Turn on emails"}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
