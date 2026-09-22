"use client";

import { useState, useTransition } from "react";
import { createLineupForRace, deleteRace } from "./actions";
import { BOAT_CLASSES } from "@/lib/boatClasses";
import { LINEUP_CATEGORIES } from "@/lib/lineupCategories";
import type { Boat, Race } from "@/lib/database.types";

export function PendingRaceRow({
  race,
  boats,
  canManage,
}: {
  race: Race;
  boats: Boat[];
  canManage: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("race_id", race.id);
    startTransition(async () => {
      try {
        await createLineupForRace(formData);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function handleDelete() {
    if (!window.confirm(`Delete the race "${race.race_name}"?`)) return;
    const formData = new FormData();
    formData.set("race_id", race.id);
    startTransition(() => deleteRace(formData));
  }

  return (
    <div className="border rounded-lg p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{race.race_name}</p>
          <p className="text-xs text-gray-500">
            {race.category ? LINEUP_CATEGORIES[race.category] : "Uncategorized"}
            {race.race_time &&
              ` · ${new Date(race.race_time).toLocaleString([], { hour: "numeric", minute: "2-digit" })}`}
          </p>
        </div>
        {canManage && (
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
          >
            Delete
          </button>
        )}
      </div>

      {!canManage && <p className="text-xs text-gray-500 mt-1">Waiting on a coach to assign a boat.</p>}

      {canManage && !open && (
        <button
          onClick={() => setOpen(true)}
          className="mt-2 text-xs border-2 border-[var(--color-primary)] rounded px-2 py-1"
        >
          Assign a boat
        </button>
      )}

      {canManage && open && (
        <form action={handleSubmit} className="mt-2 flex flex-col gap-2">
          <select name="boat_id" required defaultValue="" className="border rounded px-2 py-1 text-sm">
            <option value="" disabled>
              Choose a boat
            </option>
            {boats.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.category ? LINEUP_CATEGORIES[b.category] : BOAT_CLASSES[b.boat_class]?.label ?? b.boat_class})
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500">
            A boat&apos;s saved crew, if it has one, fills in the lineup automatically — swap any
            seat afterward.
          </p>
          <button
            type="submit"
            disabled={isPending}
            className="self-start text-xs font-medium text-white bg-[var(--color-secondary)] border-2 border-[var(--color-primary)] rounded px-2 py-1 disabled:opacity-50"
          >
            Create lineup
          </button>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setError(null);
            }}
            className="self-start text-xs text-gray-500 hover:underline"
          >
            Cancel
          </button>
        </form>
      )}
    </div>
  );
}
