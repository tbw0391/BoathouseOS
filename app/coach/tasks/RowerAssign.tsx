"use client";

import { useState, useTransition } from "react";
import {
  assignRowerToTask,
  unassignRowerFromTask,
  assignRowerGroupToTask,
  unassignRowerGroupFromTask,
} from "./actions";
import type { Profile } from "@/lib/database.types";

export function RowerAssign({
  taskId,
  roster,
  assignedIds,
}: {
  taskId: string;
  roster: Pick<Profile, "id" | "display_name" | "role">[];
  assignedIds: string[];
}) {
  const [open, setOpen] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set(assignedIds));
  const [isPending, startTransition] = useTransition();
  const rowerIds = roster.filter((p) => p.role === "rower").map((p) => p.id);
  const allRowersAssigned = rowerIds.length > 0 && rowerIds.every((id) => checkedIds.has(id));

  function toggle(userId: string, checked: boolean) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(userId);
      else next.delete(userId);
      return next;
    });
    startTransition(async () => {
      if (checked) {
        await assignRowerToTask(taskId, userId);
      } else {
        await unassignRowerFromTask(taskId, userId);
      }
    });
  }

  function toggleAllRowers(checked: boolean) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      for (const id of rowerIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
    startTransition(async () => {
      if (checked) {
        await assignRowerGroupToTask(taskId, rowerIds);
      } else {
        await unassignRowerGroupFromTask(taskId, rowerIds);
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
          {rowerIds.length > 0 && (
            <li className="flex items-center gap-2 text-sm font-medium border-b pb-1 mb-1">
              <input
                type="checkbox"
                id={`${taskId}-all-rowers`}
                checked={allRowersAssigned}
                disabled={isPending}
                onChange={(e) => toggleAllRowers(e.target.checked)}
              />
              <label htmlFor={`${taskId}-all-rowers`}>All Rowers</label>
            </li>
          )}
          {roster.map((p) => (
            <li key={p.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                id={`${taskId}-${p.id}`}
                checked={checkedIds.has(p.id)}
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
