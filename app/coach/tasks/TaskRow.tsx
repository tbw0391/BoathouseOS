"use client";

import { useState, useTransition } from "react";
import { updateCoachTask, deleteCoachTask } from "./actions";
import { RowerAssign } from "./RowerAssign";
import type { CoachTask, Profile, TaskType } from "@/lib/database.types";

export function TaskRow({
  task,
  taskTypes,
  assignedNames,
  assignedIds,
  roster,
  canManage,
}: {
  task: CoachTask;
  taskTypes: TaskType[];
  assignedNames: string[];
  assignedIds: string[];
  roster: Pick<Profile, "id" | "display_name">[];
  canManage: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await updateCoachTask(formData);
        setEditing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function remove() {
    const warning =
      assignedIds.length > 0
        ? `Delete this task? This removes it and its ${assignedIds.length} rower assignment${assignedIds.length === 1 ? "" : "s"}.`
        : "Delete this task?";
    if (!window.confirm(warning)) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteCoachTask(task.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  const typeName = taskTypes.find((t) => t.id === task.task_type_id)?.name ?? "Unknown";

  if (editing) {
    return (
      <form action={handleSubmit} className="border rounded-lg p-3 flex flex-col gap-2">
        <input type="hidden" name="task_id" value={task.id} />
        <select name="task_type_id" defaultValue={task.task_type_id} className="border rounded px-3 py-2 text-sm">
          {taskTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <input
          name="notes"
          defaultValue={task.notes ?? ""}
          placeholder="Notes (optional)"
          className="border rounded px-3 py-2 text-sm"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] rounded px-3 py-1 text-sm disabled:opacity-50"
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
    <div className="border rounded-lg p-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium">{typeName}</p>
          {task.notes && <p className="text-sm text-gray-500">{task.notes}</p>}
        </div>
        {canManage && (
          <div className="flex gap-2">
            <button onClick={() => setEditing(true)} className="text-xs border rounded px-2 py-1">
              Edit
            </button>
            <button
              onClick={remove}
              disabled={isPending}
              className="text-xs border border-red-600 text-red-600 rounded px-2 py-1 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {assignedNames.length > 0 ? (
        <ul className="text-sm text-gray-500 mt-2 list-disc list-inside">
          {assignedNames.map((name, i) => (
            <li key={i}>{name}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500 mt-2">Nobody assigned yet.</p>
      )}

      {canManage && (
        <div className="mt-2">
          <RowerAssign taskId={task.id} roster={roster} assignedIds={assignedIds} />
        </div>
      )}
      {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
    </div>
  );
}
