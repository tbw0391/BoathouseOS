"use client";

import { useState, useTransition } from "react";
import { applyTemplateToRace, createLineupForRace, deleteRace } from "./actions";
import { BOAT_CLASSES } from "@/lib/boatClasses";
import { LINEUP_CATEGORIES } from "@/lib/lineupCategories";
import type { Boat, LineupTemplate, Race } from "@/lib/database.types";

export function PendingRaceRow({
  race,
  boats,
  templates,
  canManage,
}: {
  race: Race;
  boats: Boat[];
  templates: LineupTemplate[];
  canManage: boolean;
}) {
  const [mode, setMode] = useState<"closed" | "template" | "scratch">("closed");
  const [templateId, setTemplateId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedTemplate = templates.find((t) => t.id === templateId);
  const matchingBoats = selectedTemplate
    ? boats.filter((b) => b.boat_class === selectedTemplate.boat_class)
    : [];

  function handleApplyTemplate(formData: FormData) {
    setError(null);
    formData.set("race_id", race.id);
    startTransition(async () => {
      try {
        await applyTemplateToRace(formData);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function handleBuildScratch(formData: FormData) {
    setError(null);
    formData.set("race_id", race.id);
    startTransition(async () => {
      try {
        await createLineupForRace(formData);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function handleDelete() {
    if (!window.confirm(`Delete the race "${race.race_name}"?`)) return;
    const formData = new FormData();
    formData.set("race_id", race.id);
    startTransition(() => deleteRace(formData));
  }

  return (
    <div className="border rounded-lg p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{race.race_name}</p>
          <p className="text-xs text-gray-500">
            {race.category ? LINEUP_CATEGORIES[race.category] : "Uncategorized"}
            {race.race_time &&
              ` · ${new Date(race.race_time).toLocaleString([], { hour: "numeric", minute: "2-digit" })}`}
          </p>
        </div>
        {canManage && (
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
          >
            Delete
          </button>
        )}
      </div>

      {!canManage && <p className="text-xs text-gray-500 mt-1">Waiting on a coach to assign a boat.</p>}

      {canManage && mode === "closed" && (
        <div className="mt-2 flex gap-3">
          <button
            onClick={() => setMode("template")}
            className="text-xs border-2 border-[#022e5d] rounded px-2 py-1"
          >
            Apply saved lineup
          </button>
          <button
            onClick={() => setMode("scratch")}
            className="text-xs border-2 border-[#022e5d] rounded px-2 py-1"
          >
            Build new
          </button>
        </div>
      )}

      {canManage && mode === "template" && (
        <form action={handleApplyTemplate} className="mt-2 flex flex-col gap-2">
          {templates.length === 0 ? (
            <p className="text-xs text-gray-500">
              No lineup templates yet — create one below, or build this race from scratch.
            </p>
          ) : (
            <>
              <select
                name="template_id"
                required
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value="" disabled>
                  Choose a saved lineup
                </option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({BOAT_CLASSES[t.boat_class]?.label ?? t.boat_class})
                  </option>
                ))}
              </select>

              {templateId && (
                <select name="boat_id" required defaultValue="" className="border rounded px-2 py-1 text-sm">
                  <option value="" disabled>
                    Choose a boat
                  </option>
                  {matchingBoats.length === 0 ? (
                    <option value="" disabled>
                      No matching boats in the fleet
                    </option>
                  ) : (
                    matchingBoats.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))
                  )}
                </select>
              )}

              <button
                type="submit"
                disabled={isPending || !templateId}
                className="self-start text-xs font-medium text-white bg-[#404040] border-2 border-[#022e5d] rounded px-2 py-1 disabled:opacity-50"
              >
                Apply
              </button>
            </>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="button"
            onClick={() => {
              setMode("closed");
              setError(null);
            }}
            className="self-start text-xs text-gray-500 hover:underline"
          >
            Cancel
          </button>
        </form>
      )}

      {canManage && mode === "scratch" && (
        <form action={handleBuildScratch} className="mt-2 flex flex-col gap-2">
          <select name="boat_id" required defaultValue="" className="border rounded px-2 py-1 text-sm">
            <option value="" disabled>
              Choose a boat
            </option>
            {boats.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({BOAT_CLASSES[b.boat_class]?.label ?? b.boat_class})
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={isPending}
            className="self-start text-xs font-medium text-white bg-[#404040] border-2 border-[#022e5d] rounded px-2 py-1 disabled:opacity-50"
          >
            Create lineup
          </button>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="button"
            onClick={() => {
              setMode("closed");
              setError(null);
            }}
            className="self-start text-xs text-gray-500 hover:underline"
          >
            Cancel
          </button>
        </form>
      )}
    </div>
  );
}
