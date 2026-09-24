"use client";

import { useState, useTransition } from "react";
import { updateBoat, deleteBoat } from "@/app/lineups/actions";
import { BoatTypeSelect } from "@/app/lineups/BoatsSection";
import { BOAT_CLASSES } from "@/lib/boatClasses";
import { LINEUP_CATEGORIES } from "@/lib/lineupCategories";
import { HULL_COLORS, HULL_COLOR_OPTIONS, RIGS, RIG_OPTIONS } from "@/lib/boatOptions";
import type { Boat } from "@/lib/database.types";

export function BoatCard({ boat, canManage }: { boat: Boat; canManage: boolean }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave(formData: FormData) {
    setError(null);
    formData.set("boat_id", boat.id);
    startTransition(async () => {
      try {
        await updateBoat(formData);
        setEditing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function handleDelete() {
    if (!window.confirm(`Remove "${boat.name}" from the fleet?`)) return;
    const formData = new FormData();
    formData.set("boat_id", boat.id);
    startTransition(() => deleteBoat(formData));
  }

  if (editing) {
    return (
      <form
        action={handleSave}
        className="flex flex-col gap-2 rounded-lg border-2 border-[var(--color-primary)] px-3 py-3 text-sm min-w-0"
      >
        <input
          name="name"
          defaultValue={boat.name}
          required
          className="border rounded px-2 py-1 text-sm"
        />
        <BoatTypeSelect defaultValue={boat.category ?? boat.boat_class} />

        <select
          name="hull_color"
          defaultValue={boat.hull_color ?? ""}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="">No hull color</option>
          {HULL_COLOR_OPTIONS.map((color) => (
            <option key={color} value={color}>
              {HULL_COLORS[color].label}
            </option>
          ))}
        </select>

        <select
          name="rig"
          defaultValue={boat.rig ?? ""}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="">No rig</option>
          {RIG_OPTIONS.map((rig) => (
            <option key={rig} value={rig}>
              {RIGS[rig]}
            </option>
          ))}
        </select>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="text-xs font-medium text-white bg-[var(--color-secondary)] border-2 border-[var(--color-primary)] rounded px-2 py-1 disabled:opacity-50"
          >
            {isPending ? "Saving..." : "Save"}
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

  const typeLabel = boat.category
    ? LINEUP_CATEGORIES[boat.category]
    : BOAT_CLASSES[boat.boat_class]?.label ?? boat.boat_class;

  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-[var(--color-primary)] px-3 py-3 text-sm text-center min-w-0">
      <span className="truncate w-full font-medium">{boat.name}</span>
      <span className="text-xs text-gray-500 truncate w-full">{typeLabel}</span>
      <span className="flex items-center justify-center gap-1 text-[11px] text-gray-500">
        {boat.hull_color && (
          <>
            <span
              className="w-2.5 h-2.5 rounded-full border shrink-0"
              style={{ backgroundColor: HULL_COLORS[boat.hull_color]?.swatch }}
            />
            {HULL_COLORS[boat.hull_color]?.label}
          </>
        )}
        {boat.hull_color && boat.rig && <span>·</span>}
        {boat.rig && RIGS[boat.rig]}
      </span>

      {canManage && (
        <div className="flex gap-3 mt-1">
          <button onClick={() => setEditing(true)} className="text-xs font-medium hover:underline">
            Edit
          </button>
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
