"use client";

import { useState, useTransition } from "react";
import { assignRowerToTask, unassignRowerFromTask } from "./actions";
import type { Profile } from "@/lib/database.types";

export function RowerAssign({
  taskId,
  roster,
  assignedIds,
}: {
  taskId: string;
  roster: Pick<Profile, "id" | "display_name">[];
  assignedIds: string[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const assigned = new Set(assignedIds);

  function toggle(userId: string, checked: boolean) {
    startTransition(async () => {
      if (checked) {
        await assignRowerToTask(taskId, userId);
      } else {
        await unassignRowerFromTask(taskId, userId);
      }
    });
  }

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-xs border rounded px-2 py-1"
      >
        {open ? "Done" : "Assign rowers"}
      </button>

      {open && (
        <ul className="mt-2 max-h-48 overflow-y-auto flex flex-col gap-1 border rounded p-2">
          {roster.map((p) => (
            <li key={p.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                id={`${taskId}-${p.id}`}
                defaultChecked={assigned.has(p.id)}
                disabled={isPending}
                onChange={(e) => toggle(p.id, e.target.checked)}
              />
              <label htmlFor={`${taskId}-${p.id}`}>{p.display_name}</label>
            </li>
          ))}
          {roster.length === 0 && <li className="text-sm text-gray-500">No roster members.</li>}
        </ul>
      )}
    </div>
  );
}
