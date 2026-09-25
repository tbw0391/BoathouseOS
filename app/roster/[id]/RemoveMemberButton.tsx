"use client";

import { useState, useTransition } from "react";

export function RemoveMemberButton({
  name,
  isRemoved,
  onToggle,
}: {
  name: string;
  isRemoved: boolean;
  onToggle: (next: boolean) => Promise<void>;
}) {
  const [removed, setRemoved] = useState(isRemoved);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    const next = !removed;
    if (next && !window.confirm(`Remove ${name} from the roster? They'll no longer show up, but their data isn't deleted and this can be undone.`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await onToggle(next);
        setRemoved(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={handleClick}
        disabled={isPending}
        className={
          removed
            ? "w-52 text-center text-sm border-2 border-[var(--color-primary)] rounded px-3 py-2 disabled:opacity-50"
            : "w-52 text-center text-sm border-2 border-red-600 text-red-600 rounded px-3 py-2 disabled:opacity-50"
        }
      >
        {removed ? "Restore to roster" : "Remove from roster"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
