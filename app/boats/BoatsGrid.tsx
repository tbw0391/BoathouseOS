"use client";

import { useMemo, useState } from "react";
import { BoatCard } from "./BoatCard";
import { BOAT_CLASSES } from "@/lib/boatClasses";
import { LINEUP_CATEGORIES } from "@/lib/lineupCategories";
import { HULL_COLORS, RIGS } from "@/lib/boatOptions";
import type { Boat } from "@/lib/database.types";

type SortKey = "name" | "type" | "hull_color" | "rig";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "type", label: "Type" },
  { key: "hull_color", label: "Hull color" },
  { key: "rig", label: "Rig" },
];

function sortValue(boat: Boat, key: SortKey): string {
  switch (key) {
    case "name":
      return boat.name.toLowerCase();
    case "type": {
      const label = boat.category
        ? LINEUP_CATEGORIES[boat.category]
        : BOAT_CLASSES[boat.boat_class]?.label ?? boat.boat_class;
      return (label ?? "").toLowerCase();
    }
    case "hull_color":
      return (boat.hull_color ? HULL_COLORS[boat.hull_color]?.label ?? boat.hull_color : "").toLowerCase();
    case "rig":
      return (boat.rig ? RIGS[boat.rig] ?? boat.rig : "").toLowerCase();
  }
}

export function BoatsGrid({ boats, canManage }: { boats: Boat[]; canManage: boolean }) {
  // Order of this array is sort priority: first key wins ties broken by the next.
  const [sortKeys, setSortKeys] = useState<SortKey[]>([]);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const selected = Array.from(e.target.selectedOptions, (opt) => opt.value as SortKey);
    // Keep already-selected keys in their existing priority order, then
    // append newly-selected ones at the end.
    const kept = sortKeys.filter((key) => selected.includes(key));
    const added = selected.filter((key) => !sortKeys.includes(key));
    setSortKeys([...kept, ...added]);
  }

  const sortedBoats = useMemo(() => {
    if (sortKeys.length === 0) return boats;
    return [...boats].sort((a, b) => {
      for (const key of sortKeys) {
        const cmp = sortValue(a, key).localeCompare(sortValue(b, key));
        if (cmp !== 0) return cmp;
      }
      return 0;
    });
  }, [boats, sortKeys]);

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 mb-3">
        <label htmlFor="boat-sort" className="text-sm text-gray-600">
          Sort by
        </label>
        <select
          id="boat-sort"
          multiple
          value={sortKeys}
          onChange={handleChange}
          className="border rounded px-2 py-1 text-sm"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.key} value={opt.key}>
              {opt.label}
            </option>
          ))}
        </select>
        {sortKeys.length > 0 && (
          <>
            <span className="text-xs text-gray-500">
              {sortKeys.map((key) => SORT_OPTIONS.find((o) => o.key === key)?.label).join(" → ")}
            </span>
            <button
              type="button"
              onClick={() => setSortKeys([])}
              className="text-xs text-gray-500 hover:underline"
            >
              Clear
            </button>
          </>
        )}
      </div>

      {sortedBoats.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {sortedBoats.map((boat) => (
            <BoatCard key={boat.id} boat={boat} canManage={canManage} />
          ))}
        </div>
      )}
    </div>
  );
}
