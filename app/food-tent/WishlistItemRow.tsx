"use client";

import { useState, useTransition } from "react";
import { updateWishlistItem, deleteWishlistItem } from "./actions";
import type { FoodTentWishlistItem } from "@/lib/database.types";

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

function NotesWithLinks({ notes }: { notes: string }) {
  const parts = notes.split(URL_PATTERN);
  return (
    <>
      {parts.map((part, i) =>
        URL_PATTERN.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="underline break-all"
          >
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export function WishlistItemRow({
  item,
  totalSignedUp,
  signupCount,
  showFullyClaimed,
  isManager,
}: {
  item: FoodTentWishlistItem;
  totalSignedUp: number;
  signupCount: number;
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
        await updateWishlistItem(formData);
        setEditing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function remove() {
    const warning =
      signupCount > 0
        ? `Delete "${item.title}"? This removes the whole wish list item AND everyone's signups for it (${signupCount} ${signupCount === 1 ? "person" : "people"}). If you just want to remove your own signup, use "Cancel" next to your name instead.`
        : `Delete "${item.title}"? This removes the whole wish list item.`;
    if (!window.confirm(warning)) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteWishlistItem(item.id);
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
          {item.notes && (
            <p className="text-sm text-gray-500">
              <NotesWithLinks notes={item.notes} />
            </p>
          )}
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
                title="Deletes this item for everyone, not just your own signup"
                className="text-xs border border-red-600 text-red-600 rounded px-2 py-1 disabled:opacity-50"
              >
                Delete item
              </button>
            </>
          )}
        </div>
      </div>
      {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
    </div>
  );
}
