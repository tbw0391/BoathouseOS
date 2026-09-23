"use client";

import { useRef, useState, useTransition } from "react";
import { createTaskType, deleteTaskType } from "./actions";
import type { TaskType } from "@/lib/database.types";

export function TaskTypeManager({ taskTypes }: { taskTypes: TaskType[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAdd(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createTaskType(formData);
        formRef.current?.reset();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function remove(typeId: string, name: string) {
    if (!window.confirm(`Delete task type "${name}"?`)) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteTaskType(typeId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="mb-8">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-sm font-medium text-[var(--color-primary)] hover:underline"
      >
        {open ? "Hide" : "Manage"} task types
      </button>

      {open && (
        <div className="mt-3 max-w-sm flex flex-col gap-3">
          <ul className="flex flex-col gap-1.5">
            {taskTypes.map((t) => (
              <li key={t.id} className="flex items-center justify-between text-sm border rounded px-3 py-1.5">
                {t.name}
                <button
                  onClick={() => remove(t.id, t.name)}
                  disabled={isPending}
                  className="text-xs border border-red-600 text-red-600 rounded px-2 py-1 disabled:opacity-50"
                >
                  Delete
                </button>
              </li>
            ))}
            {taskTypes.length === 0 && (
              <li className="text-sm text-gray-500">No task types yet.</li>
            )}
          </ul>

          <form ref={formRef} action={handleAdd} className="flex gap-2">
            <input
              name="name"
              placeholder="e.g. Trailer loading"
              required
              className="border rounded px-3 py-2 text-sm flex-1"
            />
            <button
              type="submit"
              disabled={isPending}
              className="bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] rounded px-3 py-2 text-sm disabled:opacity-50"
            >
              Add
            </button>
          </form>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
