"use client";

import { useRef, useState, useTransition } from "react";
import { createLineup } from "./actions";
import { BOAT_CLASSES, BOAT_CLASS_OPTIONS } from "@/lib/boatClasses";

export function CreateLineupForm({ eventId }: { eventId: string }) {
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
        className="text-sm border-2 border-[#022e5d] rounded px-3 py-2"
      >
        Add boat
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="border rounded-lg p-3 flex flex-col gap-2 max-w-sm"
    >
      <input type="hidden" name="event_id" value={eventId} />
      <input
        name="boat_name"
        placeholder="Boat name (e.g. Varsity 8)"
        required
        className="border rounded px-3 py-2 text-sm"
      />
      <select name="boat_class" defaultValue="" required className="border rounded px-3 py-2 text-sm">
        <option value="" disabled>
          Boat class
        </option>
        {BOAT_CLASS_OPTIONS.map((cls) => (
          <option key={cls} value={cls}>
            {BOAT_CLASSES[cls].label}
          </option>
        ))}
      </select>
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
          className="bg-[#404040] text-white border-2 border-[#022e5d] rounded px-3 py-2 text-sm disabled:opacity-50"
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
