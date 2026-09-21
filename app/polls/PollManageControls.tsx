"use client";

import { useState, useTransition } from "react";
import { closePoll, reopenPoll, deletePoll } from "./actions";

export function PollManageControls({ pollId, closed }: { pollId: string; closed: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleToggleClosed() {
    setError(null);
    startTransition(async () => {
      try {
        await (closed ? reopenPoll(pollId) : closePoll(pollId));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function handleDelete() {
    if (!window.confirm("Delete this poll? This removes it and everyone's votes for everyone.")) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await deletePoll(pollId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleToggleClosed}
        disabled={isPending}
        className="text-xs border rounded px-2 py-1 disabled:opacity-50"
      >
        {closed ? "Reopen" : "Close"}
      </button>
      <button
        onClick={handleDelete}
        disabled={isPending}
        className="text-xs border border-red-600 text-red-600 rounded px-2 py-1 disabled:opacity-50"
      >
        Delete
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
