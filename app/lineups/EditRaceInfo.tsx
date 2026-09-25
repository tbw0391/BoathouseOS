"use client";

import { useState, useTransition } from "react";
import { updateLineupRace } from "./actions";
import type { Lineup } from "@/lib/database.types";

function toDatetimeLocal(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function raceLabel(lineup: Pick<Lineup, "race_name" | "race_time">) {
  const timeLabel = lineup.race_time
    ? new Date(lineup.race_time).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;
  return [lineup.race_name, timeLabel].filter(Boolean).join(" · ");
}

export function EditRaceInfo({
  lineup,
  canManage,
}: {
  lineup: Pick<Lineup, "id" | "race_name" | "race_time">;
  canManage: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave(formData: FormData) {
    setError(null);
    formData.set("lineup_id", lineup.id);
    startTransition(async () => {
      try {
        await updateLineupRace(formData);
        setEditing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  const label = raceLabel(lineup);

  if (!canManage) {
    return label ? <p className="text-xs text-gray-500">{label}</p> : null;
  }

  if (editing) {
    return (
      <form action={handleSave} className="flex flex-col gap-1 mt-1">
        <input
          name="race_name"
          defaultValue={lineup.race_name ?? ""}
          placeholder="Race name (e.g. Event 4 - W V8+)"
          className="border rounded px-2 py-1 text-xs"
        />
        <input
          type="datetime-local"
          name="race_time"
          defaultValue={toDatetimeLocal(lineup.race_time)}
          className="border rounded px-2 py-1 text-xs"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="text-xs font-medium text-white bg-[var(--color-secondary)] border-2 border-[var(--color-primary)] rounded px-2 py-1 disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-xs text-gray-500 hover:underline"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="text-xs text-gray-500 hover:underline text-left mt-1"
    >
      {label || "Set race name/time"}
    </button>
  );
}
