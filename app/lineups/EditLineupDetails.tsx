"use client";

import { useState, useTransition } from "react";
import { updateLineupDetails } from "./actions";
import { LINEUP_CATEGORIES, LINEUP_CATEGORY_GROUPS } from "@/lib/lineupCategories";
import type { Lineup } from "@/lib/database.types";

// Coach/admin: change a boat entry's category (which squad fills its seats)
// and notes after it's been created.
export function EditLineupDetails({
  lineup,
  canManage,
}: {
  lineup: Pick<Lineup, "id" | "category" | "notes">;
  canManage: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const categoryLabel = lineup.category ? LINEUP_CATEGORIES[lineup.category] ?? lineup.category : null;

  if (!canManage) {
    return lineup.notes ? <p className="text-sm text-gray-500">{lineup.notes}</p> : null;
  }

  function handleSave(formData: FormData) {
    setError(null);
    formData.set("lineup_id", lineup.id);
    startTransition(async () => {
      try {
        await updateLineupDetails(formData);
        setEditing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  if (editing) {
    return (
      <form action={handleSave} className="flex flex-col gap-1 mt-1">
        <select
          name="category"
          defaultValue={lineup.category ?? ""}
          className="border rounded px-2 py-1 text-xs"
        >
          <option value="">No category</option>
          {LINEUP_CATEGORY_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.options.map((cat) => (
                <option key={cat} value={cat}>
                  {LINEUP_CATEGORIES[cat]}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <textarea
          name="notes"
          rows={2}
          defaultValue={lineup.notes ?? ""}
          placeholder="Notes (optional)"
          className="border rounded px-2 py-1 text-xs"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="text-xs font-medium text-white bg-[var(--color-secondary)] border-2 border-[var(--color-primary)] rounded px-2 py-1 disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-xs text-gray-500 hover:underline"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="flex flex-col items-start text-left mt-1 hover:underline"
    >
      <span className="text-xs text-gray-500">{categoryLabel ?? "Set category"}</span>
      <span className="text-sm text-gray-500">{lineup.notes ?? "Add notes"}</span>
    </button>
  );
}
