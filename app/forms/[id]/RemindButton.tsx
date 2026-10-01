"use client";

import { useState, useTransition } from "react";
import { remindForm } from "../actions";
import { unwrap } from "@/lib/userError";

export function RemindButton({ formId, count, remindedLabel }: { formId: string; count: number; remindedLabel: string | null }) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={pending || count === 0}
        onClick={() => {
          setError(null);
          start(async () => {
            try {
              const { count: sent } = unwrap(await remindForm(formId));
              setMessage(`Reminder sent to ${sent} ${sent === 1 ? "person" : "people"} ✓`);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Something went wrong.");
            }
          });
        }}
        className="self-start text-sm bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] rounded px-3 py-1.5 disabled:opacity-50"
      >
        {pending ? "Sending…" : `Remind them (${count})`}
      </button>
      {message && <p className="text-sm text-green-700">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!message && remindedLabel && <p className="text-xs text-gray-500">Last reminder: {remindedLabel}</p>}
      <p className="text-xs text-gray-500">
        A phone alert to just these people. Everyone who hasn&apos;t answered also gets one automatically the day before it
        closes.
      </p>
    </div>
  );
}
