"use client";

import { useState, useTransition } from "react";
import { ShieldCheck } from "lucide-react";
import { unwrap } from "@/lib/userError";
import { setNoMessageRequest } from "./noMessageActions";

// SafeSport: a parent can ask that coaches and other adults not message
// their child. Parents and admins can change it; coaches see it.
export function NoMessagesCard({
  rowerId,
  firstName,
  requestedAt,
  canChange,
}: {
  rowerId: string;
  firstName: string;
  requestedAt: string | null;
  canChange: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const on = requestedAt !== null;

  function toggle() {
    setError(null);
    startTransition(async () => {
      try {
        unwrap(await setNoMessageRequest(rowerId, !on));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save.");
      }
    });
  }

  return (
    <div className="mt-6 max-w-lg rounded-lg border-2 border-gray-200 p-4 flex flex-col gap-2">
      <h2 className="font-semibold flex items-center gap-2">
        <ShieldCheck className="w-5 h-5" aria-hidden />
        Messages from adults
      </h2>
      {on ? (
        <p className="text-sm">
          A parent asked on {new Date(requestedAt).toLocaleDateString("en-US", { timeZone: "America/New_York" })} that
          coaches and other adults not message {firstName}. {firstName} is kept out of chats with adults, and
          parents get those messages instead. Safety alerts still go out.
        </p>
      ) : (
        <p className="text-sm">
          Coaches and other adults can message {firstName}; a parent is always included in those chats.
        </p>
      )}
      {canChange && (
        <button
          type="button"
          disabled={isPending}
          onClick={toggle}
          className="self-start rounded border px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {on ? "Allow messages again" : `Ask that adults not message ${firstName}`}
        </button>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
