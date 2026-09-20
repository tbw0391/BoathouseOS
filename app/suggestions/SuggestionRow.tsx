"use client";

import { useTransition } from "react";
import { markReviewed, deleteSuggestion } from "./actions";
import type { Suggestion } from "@/lib/database.types";

export function SuggestionRow({
  suggestion,
  submitterName,
}: {
  suggestion: Suggestion;
  submitterName: string;
}) {
  const [isPending, startTransition] = useTransition();
  const reviewed = suggestion.status === "reviewed";

  function toggleReviewed() {
    startTransition(async () => {
      await markReviewed(suggestion.id, !reviewed);
    });
  }

  function remove() {
    if (!window.confirm("Delete this suggestion?")) return;
    startTransition(async () => {
      await deleteSuggestion(suggestion.id);
    });
  }

  return (
    <div className={`border rounded-lg p-4 flex flex-col gap-2 ${reviewed ? "opacity-50" : ""}`}>
      <p className="text-sm">{suggestion.body}</p>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {submitterName} · {new Date(suggestion.created_at).toLocaleDateString()}
        </span>
        <div className="flex gap-2">
          <button
            onClick={toggleReviewed}
            disabled={isPending}
            className="border rounded px-2 py-1 disabled:opacity-50"
          >
            {reviewed ? "Mark new" : "Mark reviewed"}
          </button>
          <button
            onClick={remove}
            disabled={isPending}
            className="border border-red-600 text-red-600 rounded px-2 py-1 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
