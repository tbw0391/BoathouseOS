"use client";

import { useState, useTransition } from "react";
import { updateLineupPlace } from "./actions";
import { ordinalPlace, placeEmoji } from "@/lib/raceResults";
import type { Lineup } from "@/lib/database.types";

export function EditRaceResult({
  lineup,
  canManage,
}: {
  lineup: Pick<Lineup, "id" | "place" | "result_time">;
  canManage: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave(formData: FormData) {
    setError(null);
    formData.set("lineup_id", lineup.id);
    startTransition(async () => {
      try {
        await updateLineupPlace(formData);
        setEditing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function clear() {
    setError(null);
    const formData = new FormData();
    formData.set("lineup_id", lineup.id);
    formData.set("place", "");
    startTransition(async () => {
      try {
        await updateLineupPlace(formData);
        setEditing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  if (!canManage) {
    return lineup.place ? (
      <p className="text-xs font-medium mt-1">
        {placeEmoji(lineup.place)} {ordinalPlace(lineup.place)} place
        {lineup.result_time && ` — ${lineup.result_time}`}
      </p>
    ) : null;
  }

  if (editing) {
    return (
      <form action={handleSave} className="flex flex-col gap-1 mt-1">
        <input
          type="number"
          name="place"
          min={1}
          defaultValue={lineup.place ?? ""}
          placeholder="Finishing place (e.g. 1)"
          className="border rounded px-2 py-1 text-xs w-40"
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
          {lineup.place != null && (
            <button
              type="button"
              onClick={clear}
              disabled={isPending}
              className="text-xs text-red-600 hover:underline"
            >
              Clear
            </button>
          )}
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
      className="text-xs text-gray-500 hover:underline text-left mt-1"
    >
      {lineup.place
        ? `${placeEmoji(lineup.place)} ${ordinalPlace(lineup.place)} place${
            lineup.result_time ? ` — ${lineup.result_time}` : ""
          }`
        : "Enter result"}
    </button>
  );
}
