"use client";

import { useState, useTransition } from "react";
import { updateFoodTentItem, deleteFoodTentItem } from "./actions";
import type { FoodTentItem } from "@/lib/database.types";

export function ItemRow({
  item,
  totalSignedUp,
  showFullyClaimed,
  isManager,
}: {
  item: FoodTentItem;
  totalSignedUp: number;
  showFullyClaimed: boolean;
  isManager: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await updateFoodTentItem(formData);
        setEditing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function remove() {
    if (!window.confirm("Delete this item request?")) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteFoodTentItem(item.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  if (editing) {
    return (
      <form action={handleSubmit} className="flex flex-col gap-2">
        <input type="hidden" name="item_id" value={item.id} />
        <input
          name="title"
          defaultValue={item.title}
          required
          className="border rounded px-3 py-2 text-sm"
        />
        <input
          name="quantity_needed"
          type="number"
          min={1}
          defaultValue={item.quantity_needed}
          className="border rounded px-3 py-2 text-sm"
        />
        <input
          name="notes"
          defaultValue={item.notes ?? ""}
          placeholder="Notes (optional)"
          className="border rounded px-3 py-2 text-sm"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="bg-[#404040] text-white border-2 border-[#022e5d] rounded px-3 py-1 text-sm disabled:opacity-50"
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
            {item.title}{" "}
            <span className="text-sm text-gray-500">
              ({totalSignedUp}/{item.quantity_needed})
            </span>
          </p>
          {item.notes && <p className="text-sm text-gray-500">{item.notes}</p>}
        </div>
        <div className="flex items-center gap-2">
          {showFullyClaimed && <span className="text-sm text-gray-500">Fully claimed</span>}
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
