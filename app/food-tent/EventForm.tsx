"use client";

import { useRef, useState, useTransition } from "react";
import { createRegattaEvent } from "./actions";

export function EventForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createRegattaEvent(formData);
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
        Add regatta day
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="border rounded-lg p-4 flex flex-col gap-3 max-w-md"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-medium">Add regatta day</h2>
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
        placeholder="Regatta name"
        required
        className="border rounded px-3 py-2 text-sm"
      />
      <input
        name="starts_at"
        type="date"
        required
        className="border rounded px-3 py-2 text-sm"
      />
      <input
        name="location"
        placeholder="Location (optional)"
        className="border rounded px-3 py-2 text-sm"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="bg-[#404040] text-white border-2 border-[#022e5d] rounded px-3 py-2 text-sm disabled:opacity-50"
      >
        {isPending ? "Adding..." : "Add"}
      </button>
    </form>
  );
}
