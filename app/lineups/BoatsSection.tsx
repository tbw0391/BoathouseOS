"use client";

import { useRef, useState, useTransition } from "react";
import { createBoat, updateBoat, deleteBoat } from "./actions";
import { BOAT_CLASSES, BOAT_CLASS_OPTIONS } from "@/lib/boatClasses";
import { LINEUP_CATEGORIES, LINEUP_CATEGORY_TEAM, FLEET_CATEGORY_GROUPS, CATEGORY_BOAT_CLASS } from "@/lib/lineupCategories";
import type { Boat, Team } from "@/lib/database.types";

// Boats with no category (singles/doubles/pairs) aren't tied to a team, so
// they get no shading — only a men's/women's/masters depth-chart boat does.
const TEAM_BG: Partial<Record<Team, string>> = {
  mens: "bg-blue-50",
  womens: "bg-gray-100",
  masters: "bg-yellow-50",
};

// Boats out of the Men's/Women's depth scheme (singles, doubles, pairs) —
// offered as a plain boat-class fallback in the same picker.
const OTHER_BOAT_CLASSES = BOAT_CLASS_OPTIONS.filter(
  (cls) => !Object.values(CATEGORY_BOAT_CLASS).includes(cls)
);

export function BoatTypeSelect({ defaultValue }: { defaultValue: string }) {
  return (
    <select name="boat_type" defaultValue={defaultValue} required className="border rounded px-2 py-1 text-sm">
      <option value="" disabled>
        Boat type
      </option>
      {FLEET_CATEGORY_GROUPS.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.options.map((cat) => (
            <option key={cat} value={cat}>
              {LINEUP_CATEGORIES[cat]}
            </option>
          ))}
        </optgroup>
      ))}
      <optgroup label="Other">
        {OTHER_BOAT_CLASSES.map((cls) => (
          <option key={cls} value={cls}>
            {BOAT_CLASSES[cls].label}
          </option>
        ))}
      </optgroup>
    </select>
  );
}

function BoatRow({ boat }: { boat: Boat }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave(formData: FormData) {
    setError(null);
    formData.set("boat_id", boat.id);
    startTransition(async () => {
      try {
        await updateBoat(formData);
        setEditing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function handleDelete() {
    if (!window.confirm("Remove this boat from the fleet?")) return;
    const formData = new FormData();
    formData.set("boat_id", boat.id);
    startTransition(() => deleteBoat(formData));
  }

  if (editing) {
    return (
      <li className="flex flex-col gap-2 border rounded p-2">
        <form action={handleSave} className="flex flex-col gap-2">
          <input
            name="name"
            defaultValue={boat.name}
            required
            className="border rounded px-2 py-1 text-sm"
          />
          <BoatTypeSelect defaultValue={boat.category ?? boat.boat_class} />
          {error && <p className="text-sm text-red-600">{error}</p>}
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
      </li>
    );
  }

  const typeLabel = boat.category ? LINEUP_CATEGORIES[boat.category] : BOAT_CLASSES[boat.boat_class]?.label ?? boat.boat_class;
  const team = boat.category ? LINEUP_CATEGORY_TEAM[boat.category] : null;

  return (
    <li className={`flex items-center justify-between text-sm rounded px-2 py-1 ${team ? TEAM_BG[team] ?? "" : ""}`}>
      <span>
        {boat.name} <span className="text-gray-500">({typeLabel})</span>
      </span>
      <div className="flex gap-3">
        <button onClick={() => setEditing(true)} className="text-xs font-medium hover:underline">
          Edit
        </button>
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
        >
          Remove
        </button>
      </div>
    </li>
  );
}

export function BoatsSection({ boats }: { boats: Boat[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createBoat(formData);
        formRef.current?.reset();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <details
      className="mb-8 border rounded-lg p-4 max-w-lg"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="cursor-pointer text-sm font-medium text-gray-600">
        Fleet ({boats.length} boat{boats.length === 1 ? "" : "s"})
      </summary>

      {boats.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {boats.map((boat) => (
            <BoatRow key={boat.id} boat={boat} />
          ))}
        </ul>
      )}

      <form ref={formRef} action={handleSubmit} className="mt-4 flex flex-col gap-2">
        <input name="name" placeholder="Boat name" required className="border rounded px-3 py-2 text-sm" />
        <BoatTypeSelect defaultValue="" />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={isPending}
          className="self-start bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] rounded px-3 py-2 text-sm disabled:opacity-50"
        >
          {isPending ? "Adding..." : "Add to fleet"}
        </button>
      </form>
    </details>
  );
}
