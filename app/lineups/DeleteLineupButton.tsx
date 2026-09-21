"use client";

import { useTransition } from "react";
import { deleteLineup } from "./actions";

export function DeleteLineupButton({ lineupId }: { lineupId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!window.confirm("Delete this boat and its seat assignments?")) return;
    const formData = new FormData();
    formData.set("lineup_id", lineupId);
    startTransition(() => deleteLineup(formData));
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
    >
      Delete boat
    </button>
  );
}
