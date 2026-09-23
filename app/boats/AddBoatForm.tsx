"use client";

import { useRef, useState, useTransition } from "react";
import { createBoat } from "@/app/lineups/actions";
import { BoatTypeSelect } from "@/app/lineups/BoatsSection";

export function AddBoatForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createBoat(formData);
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
        className="rounded bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] text-sm px-3 py-2"
      >
        Add Boat
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="border rounded-lg p-4 flex flex-col gap-3 w-full max-w-md"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-medium">Add boat</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-gray-500 hover:underline"
        >
          Cancel
        </button>
      </div>

      <input name="name" placeholder="Boat name" required className="border rounded px-3 py-2 text-sm" />
      <BoatTypeSelect defaultValue="" />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] rounded px-3 py-2 text-sm disabled:opacity-50"
      >
        {isPending ? "Adding..." : "Add boat"}
      </button>
    </form>
  );
}
