"use client";

import { useTransition } from "react";
import { markResolved, deleteMaintenanceRequest } from "./actions";
import type { MaintenanceRequest, MaintenanceType } from "@/lib/database.types";

export function RequestRow({
  type,
  request,
  submitterName,
  boatName,
}: {
  type: MaintenanceType;
  request: MaintenanceRequest;
  submitterName: string;
  boatName?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const resolved = request.status === "resolved";

  function toggleResolved() {
    startTransition(async () => {
      await markResolved(type, request.id, !resolved);
    });
  }

  function remove() {
    if (!window.confirm("Delete this request?")) return;
    startTransition(async () => {
      await deleteMaintenanceRequest(type, request.id);
    });
  }

  return (
    <div className={`border rounded-lg p-4 flex flex-col gap-2 ${resolved ? "opacity-50" : ""}`}>
      {boatName && <p className="text-sm font-medium">{boatName}</p>}
      <p className="text-sm">{request.description}</p>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {submitterName} · {new Date(request.created_at).toLocaleDateString()}
        </span>
        <div className="flex gap-2">
          <button
            onClick={toggleResolved}
            disabled={isPending}
            className="border rounded px-2 py-1 disabled:opacity-50"
          >
            {resolved ? "Mark open" : "Mark resolved"}
          </button>
          <button
            onClick={remove}
            disabled={isPending}
            className="border border-red-600 text-red-600 rounded px-2 py-1 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
