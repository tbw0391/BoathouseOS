"use client";

import { useRef, useState, useTransition } from "react";
import { addWishlistItem } from "./actions";

export function WishlistItemForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await addWishlistItem(formData);
        formRef.current?.reset();
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm border-2 border-[var(--color-primary)] rounded px-3 py-2"
      >
        Add wish list item
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="border rounded-lg p-3 flex flex-col gap-2 max-w-sm"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Add wish list item</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-gray-500 hover:underline"
        >
          Cancel
        </button>
      </div>
      <input
        name="title"
        placeholder="e.g. Rolling cooler"
        required
        className="border rounded px-3 py-2 text-sm"
      />
      <input
        name="quantity_needed"
        type="number"
        min={1}
        defaultValue={1}
        placeholder="Quantity needed"
        className="border rounded px-3 py-2 text-sm"
      />
      <input
        name="notes"
        placeholder="Notes (optional, e.g. price and a link)"
        className="border rounded px-3 py-2 text-sm"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] rounded px-3 py-2 text-sm disabled:opacity-50"
      >
        {isPending ? "Adding..." : "Add item"}
      </button>
    </form>
  );
}
