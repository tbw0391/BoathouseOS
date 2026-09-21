"use client";

import { useRef, useState, useTransition } from "react";
import { createBoat, deleteBoat } from "./actions";
import { BOAT_CLASSES, BOAT_CLASS_OPTIONS } from "@/lib/boatClasses";
import type { Boat } from "@/lib/database.types";

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

  function handleDelete(boatId: string) {
    if (!window.confirm("Remove this boat from the fleet?")) return;
    const formData = new FormData();
    formData.set("boat_id", boatId);
    startTransition(() => deleteBoat(formData));
  }

  return (
    <details className="mb-8 border rounded-lg p-4 max-w-lg" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="cursor-pointer text-sm font-medium text-gray-600">
        Fleet ({boats.length} boat{boats.length === 1 ? "" : "s"})
      </summary>

      {boats.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {boats.map((boat) => (
            <li key={boat.id} className="flex items-center justify-between text-sm">
              <span>
                {boat.name}{" "}
                <span className="text-gray-500">
                  ({BOAT_CLASSES[boat.boat_class]?.label ?? boat.boat_class})
                </span>
              </span>
              <button
                onClick={() => handleDelete(boat.id)}
                disabled={isPending}
                className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <form ref={formRef} action={handleSubmit} className="mt-4 flex flex-col gap-2">
        <input name="name" placeholder="Boat name" required className="border rounded px-3 py-2 text-sm" />
        <select name="boat_class" defaultValue="" required className="border rounded px-3 py-2 text-sm">
          <option value="" disabled>
            Boat class
          </option>
          {BOAT_CLASS_OPTIONS.map((cls) => (
            <option key={cls} value={cls}>
              {BOAT_CLASSES[cls].label}
            </option>
          ))}
        </select>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={isPending}
          className="self-start bg-[#404040] text-white border-2 border-[#022e5d] rounded px-3 py-2 text-sm disabled:opacity-50"
        >
          {isPending ? "Adding..." : "Add to fleet"}
        </button>
      </form>
    </details>
  );
}
