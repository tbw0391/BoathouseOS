"use client";

import { useRef, useState, useTransition } from "react";
import { createCoachTask } from "./actions";
import type { TaskType } from "@/lib/database.types";

export function TaskForm({ eventId, taskTypes }: { eventId: string; taskTypes: TaskType[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createCoachTask(formData);
        formRef.current?.reset();
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  if (taskTypes.length === 0) {
    return (
      <p className="text-sm text-gray-500">Add a task type above before assigning a task.</p>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm border-2 border-[var(--color-primary)] rounded px-3 py-2 self-start"
      >
        Add a task
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
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Add a task</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-gray-500 hover:underline"
        >
          Cancel
        </button>
      </div>
      <select name="task_type_id" required className="border rounded px-3 py-2 text-sm">
        {taskTypes.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <input
        name="notes"
        placeholder="Notes (optional)"
        className="border rounded px-3 py-2 text-sm"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] rounded px-3 py-2 text-sm disabled:opacity-50"
      >
        {isPending ? "Adding..." : "Add task"}
      </button>
    </form>
  );
}
