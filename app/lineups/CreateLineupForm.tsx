"use client";

import { useRef, useState, useTransition } from "react";
import { createLineup } from "./actions";
import { BOAT_CLASSES } from "@/lib/boatClasses";
import { LINEUP_CATEGORIES, LINEUP_CATEGORY_GROUPS } from "@/lib/lineupCategories";
import type { Boat } from "@/lib/database.types";

export function CreateLineupForm({ eventId, boats }: { eventId: string; boats: Boat[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createLineup(formData);
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
        Add boat
      </button>
    );
  }

  if (boats.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Add a boat to the fleet above before creating a lineup.{" "}
        <button onClick={() => setOpen(false)} className="underline">
          Close
        </button>
      </p>
    );
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="border rounded-lg p-3 flex flex-col gap-2 max-w-sm"
    >
      <input type="hidden" name="event_id" value={eventId} />
      <select name="boat_id" defaultValue="" required className="border rounded px-3 py-2 text-sm">
        <option value="" disabled>
          Boat
        </option>
        {boats.map((boat) => (
          <option key={boat.id} value={boat.id}>
            {boat.name} ({boat.category ? LINEUP_CATEGORIES[boat.category] : BOAT_CLASSES[boat.boat_class]?.label ?? boat.boat_class})
          </option>
        ))}
      </select>
      <select name="category" defaultValue="" required className="border rounded px-3 py-2 text-sm">
        <option value="" disabled>
          Category
        </option>
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
      <input
        name="race_name"
        placeholder="Race name (optional, e.g. Event 4 - W V8+)"
        className="border rounded px-3 py-2 text-sm"
      />
      <label className="flex flex-col gap-1 text-xs text-gray-500">
        Race time (optional)
        <input
          type="datetime-local"
          name="race_time"
          className="border rounded px-3 py-2 text-sm text-black"
        />
      </label>
      <textarea
        name="notes"
        rows={2}
        placeholder="Notes (optional)"
        className="border rounded px-3 py-2 text-sm"
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] rounded px-3 py-2 text-sm disabled:opacity-50"
        >
          {isPending ? "Adding..." : "Add boat"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-gray-500 hover:underline"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
