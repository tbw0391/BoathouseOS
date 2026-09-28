"use client";

import { useState, useTransition } from "react";
import { getCalendarFeedToken } from "./calendarActions";

// "Add to my phone's calendar": a private feed link the calendar app keeps
// checking, so changes show up on their own.
export function CalendarSubscribe({ host }: { host: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function load(reset = false) {
    setError(null);
    start(async () => {
      try {
        setToken(await getCalendarFeedToken(reset));
        setCopied(false);
      } catch {
        setError("Couldn't make your calendar link. Please try again.");
      }
    });
  }

  const httpsUrl = token ? `https://${host}/api/calendar/${token}.ics` : "";
  const webcalUrl = token ? `webcal://${host}/api/calendar/${token}.ics` : "";

  if (!token) {
    return (
      <div className="max-w-md">
        <button
          type="button"
          onClick={() => load()}
          disabled={pending}
          className="rounded-lg border-2 border-[var(--color-primary)] px-4 py-2 font-medium hover:bg-[var(--color-secondary)] hover:text-white disabled:opacity-50"
        >
          {pending ? "One moment…" : "Add to my phone's calendar"}
        </button>
        {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
      </div>
    );
  }

  return (
    <div className="max-w-md rounded-lg border-2 border-gray-200 p-4 flex flex-col gap-3 text-sm">
      <p>
        Practices, regattas and your races (with launch times) show up in your calendar app and stay up to
        date on their own.
      </p>
      <a
        href={webcalUrl}
        className="self-start bg-[var(--color-primary)] text-white rounded px-4 py-2 font-medium"
      >
        Subscribe on this phone
      </a>
      <div>
        <p className="text-gray-600 mb-1">Google Calendar or a computer: copy this link, then add it as a calendar &ldquo;From URL&rdquo;.</p>
        <div className="flex gap-2">
          <input readOnly value={httpsUrl} className="flex-1 min-w-0 border rounded px-2 py-1 text-xs" onFocus={(e) => e.target.select()} />
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(httpsUrl);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
            className="rounded border-2 border-gray-300 px-2 py-1 text-xs"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-500">
        Keep this link to yourself: anyone with it can see the schedule and your races.{" "}
        <button type="button" onClick={() => load(true)} disabled={pending} className="underline">
          Make a new link
        </button>{" "}
        (the old one stops working).
      </p>
    </div>
  );
}
