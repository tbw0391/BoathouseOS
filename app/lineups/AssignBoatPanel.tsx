"use client";

import { useState, useTransition } from "react";
import { createLineupForRace, deleteRace } from "./actions";
import { BOAT_CLASSES } from "@/lib/boatClasses";
import { LINEUP_CATEGORIES, LINEUP_CATEGORY_TEAM } from "@/lib/lineupCategories";
import type { Boat, LineupCategory } from "@/lib/database.types";

export function AssignBoatPanel({
  raceId,
  boats,
  category,
}: {
  raceId: string;
  boats: Boat[];
  category: LineupCategory | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // A race's category (e.g. a men's depth chart entry) only fields boats
  // built for that same team; boats with no category (singles/doubles/pairs)
  // aren't gendered, so they stay available regardless of the race.
  const raceTeam = category ? LINEUP_CATEGORY_TEAM[category] : null;
  const eligibleBoats = raceTeam
    ? boats.filter((b) => !b.category || LINEUP_CATEGORY_TEAM[b.category as LineupCategory] === raceTeam)
    : boats;

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("race_id", raceId);
    startTransition(async () => {
      try {
        await createLineupForRace(formData);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function handleDelete() {
    if (!window.confirm("Delete this race?")) return;
    const formData = new FormData();
    formData.set("race_id", raceId);
    startTransition(() => deleteRace(formData));
  }

  return (
    <div className="border rounded-lg p-4">
      <form action={handleSubmit} className="flex flex-col gap-2">
        <label className="text-sm font-medium">Assign a boat</label>
        {boats.length === 0 ? (
          <p className="text-xs text-gray-500">Add a boat to the fleet above first.</p>
        ) : eligibleBoats.length === 0 ? (
          <p className="text-xs text-gray-500">
            No {category ? LINEUP_CATEGORIES[category].split(" ")[0] : ""} boats in the fleet yet.
          </p>
        ) : (
          <>
            <select name="boat_id" required defaultValue="" className="border rounded px-2 py-1 text-sm">
              <option value="" disabled>
                Choose a boat
              </option>
              {eligibleBoats.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} (
                  {b.category ? LINEUP_CATEGORIES[b.category] : BOAT_CLASSES[b.boat_class]?.label ?? b.boat_class})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500">
              A boat&apos;s saved crew, if it has one, fills in the lineup automatically — swap any
              seat afterward.
            </p>
          </>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          {eligibleBoats.length > 0 && (
            <button
              type="submit"
              disabled={isPending}
              className="self-start text-xs font-medium text-white bg-[var(--color-secondary)] border-2 border-[var(--color-primary)] rounded px-3 py-1.5 disabled:opacity-50"
            >
              Create lineup
            </button>
          )}
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="self-start text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
          >
            Delete race
          </button>
        </div>
      </form>
    </div>
  );
}
