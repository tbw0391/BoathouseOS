"use client";

import { useState, useTransition } from "react";
import { unwrap } from "@/lib/userError";
import { deleteLineup } from "./actions";

export function DeleteLineupButton({ lineupId }: { lineupId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!window.confirm("Delete this boat and its seat assignments?")) return;
    const formData = new FormData();
    formData.set("lineup_id", lineupId);
    setError(null);
    startTransition(async () => {
      try {
        unwrap(await deleteLineup(formData));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={isPending}
        className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
      >
        Delete boat
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </>
  );
}
