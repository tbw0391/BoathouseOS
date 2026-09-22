"use client";

import { useState, useTransition } from "react";
import { updateVolunteerNeed, deleteVolunteerNeed } from "./actions";
import type { VolunteerNeed } from "@/lib/database.types";

export function NeedRow({
  need,
  slotsFilled,
  signupCount,
  isManager,
}: {
  need: VolunteerNeed;
  slotsFilled: number;
  signupCount: number;
  isManager: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await updateVolunteerNeed(formData);
        setEditing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function remove() {
    const warning =
      signupCount > 0
        ? `Delete "${need.title}"? This removes the whole slot AND everyone's signups for it (${signupCount} ${signupCount === 1 ? "person" : "people"}).`
        : `Delete "${need.title}"?`;
    if (!window.confirm(warning)) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteVolunteerNeed(need.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  if (editing) {
    return (
      <form action={handleSubmit} className="flex flex-col gap-2">
        <input type="hidden" name="need_id" value={need.id} />
        <input
          name="title"
          defaultValue={need.title}
          required
          className="border rounded px-3 py-2 text-sm"
        />
        <input
          name="slots_needed"
          type="number"
          min={1}
          defaultValue={need.slots_needed}
          className="border rounded px-3 py-2 text-sm"
        />
        <input
          name="description"
          defaultValue={need.description ?? ""}
          placeholder="Notes (optional)"
          className="border rounded px-3 py-2 text-sm"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] rounded px-3 py-1 text-sm disabled:opacity-50"
          >
            {isPending ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-sm text-gray-500 hover:underline"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">
            {need.title}{" "}
            <span className="text-sm text-gray-500">
              ({slotsFilled}/{need.slots_needed})
            </span>
          </p>
          {need.description && <p className="text-sm text-gray-500">{need.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {slotsFilled >= need.slots_needed && (
            <span className="text-sm text-gray-500">Filled</span>
          )}
          {isManager && (
            <>
              <button
                onClick={() => setEditing(true)}
                className="text-xs border rounded px-2 py-1"
              >
                Edit
              </button>
              <button
                onClick={remove}
                disabled={isPending}
                className="text-xs border border-red-600 text-red-600 rounded px-2 py-1 disabled:opacity-50"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>
      {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
    </div>
  );
}
