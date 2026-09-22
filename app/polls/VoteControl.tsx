"use client";

import { useState, useTransition } from "react";
import { castVote, clearVote } from "./actions";

export function VoteControl({
  pollId,
  options,
  allowMultiple,
  myOptionIds,
  closed,
}: {
  pollId: string;
  options: { id: string; label: string }[];
  allowMultiple: boolean;
  myOptionIds: string[];
  closed: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const hasVoted = myOptionIds.length > 0;

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("poll_id", pollId);
    startTransition(async () => {
      try {
        await castVote(formData);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function handleClear() {
    setError(null);
    const formData = new FormData();
    formData.set("poll_id", pollId);
    startTransition(async () => {
      try {
        await clearVote(formData);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  if (closed) {
    return hasVoted ? (
      <p className="text-sm text-gray-500">Poll closed — you voted.</p>
    ) : (
      <p className="text-sm text-gray-500">Poll closed.</p>
    );
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        {options.map((o) => (
          <label key={o.id} className="flex items-center gap-2 text-sm">
            <input
              type={allowMultiple ? "checkbox" : "radio"}
              name="option_id"
              value={o.id}
              defaultChecked={myOptionIds.includes(o.id)}
              className="w-4 h-4"
            />
            {o.label}
          </label>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="text-sm bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] rounded px-3 py-1.5 disabled:opacity-50"
        >
          {isPending ? "Saving..." : hasVoted ? "Update vote" : "Vote"}
        </button>
        {hasVoted && (
          <button
            type="button"
            onClick={handleClear}
            disabled={isPending}
            className="text-sm text-red-600 hover:underline disabled:opacity-50"
          >
            Clear my vote
          </button>
        )}
      </div>
    </form>
  );
}
