"use client";

import { useState, useTransition } from "react";

export function RoleToggle({
  initialValue,
  onLabel,
  offLabel,
  onToggle,
}: {
  initialValue: boolean;
  onLabel: string;
  offLabel: string;
  onToggle: (next: boolean) => Promise<void>;
}) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    const next = !value;
    setError(null);
    startTransition(async () => {
      try {
        await onToggle(next);
        setValue(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={handleToggle}
        disabled={isPending}
        className="w-52 text-center text-sm border-2 border-[var(--color-primary)] rounded px-3 py-2 disabled:opacity-50"
      >
        {value ? offLabel : onLabel}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
