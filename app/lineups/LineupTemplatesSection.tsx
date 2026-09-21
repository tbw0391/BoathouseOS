"use client";

import { useRef, useState, useTransition } from "react";
import {
  createLineupTemplate,
  deleteLineupTemplate,
  assignTemplateSeat,
} from "./actions";
import { BOAT_CLASSES, BOAT_CLASS_OPTIONS } from "@/lib/boatClasses";
import { LINEUP_CATEGORIES, LINEUP_CATEGORY_OPTIONS } from "@/lib/lineupCategories";
import { SeatAssign } from "./SeatAssign";
import type { LineupTemplate, LineupTemplateSeat, Profile } from "@/lib/database.types";

const SEAT_ROLE_LABEL: Record<LineupTemplateSeat["seat_role"], string> = {
  rower: "Seat",
  coxswain: "Coxswain",
  coach: "Coach",
};

function TemplateCard({
  template,
  seats,
  roster,
}: {
  template: LineupTemplate;
  seats: LineupTemplateSeat[];
  roster: Pick<Profile, "id" | "display_name">[];
}) {
  const [isPending, startTransition] = useTransition();

  function remove() {
    if (!window.confirm(`Delete the "${template.name}" template?`)) return;
    startTransition(() => deleteLineupTemplate(template.id));
  }

  return (
    <div className="border rounded-lg p-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium">{template.name}</p>
          <p className="text-xs text-gray-500">
            {BOAT_CLASSES[template.boat_class]?.label ?? template.boat_class}
            {template.category && ` · ${LINEUP_CATEGORIES[template.category]}`}
          </p>
          {template.notes && <p className="text-sm text-gray-500 mt-1">{template.notes}</p>}
        </div>
        <button
          onClick={remove}
          disabled={isPending}
          className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
        >
          Delete
        </button>
      </div>

      <ul className="mt-2 flex flex-col gap-1.5">
        {seats.map((seat) => (
          <li key={seat.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="text-gray-500">
              {seat.seat_role === "rower"
                ? `${SEAT_ROLE_LABEL[seat.seat_role]} ${seat.seat_number}`
                : SEAT_ROLE_LABEL[seat.seat_role]}
            </span>
            <SeatAssign
              seatId={seat.id}
              currentRowerId={seat.rower_id}
              roster={roster}
              onAssign={assignTemplateSeat}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LineupTemplatesSection({
  templates,
  templateSeats,
  roster,
}: {
  templates: LineupTemplate[];
  templateSeats: LineupTemplateSeat[];
  roster: Pick<Profile, "id" | "display_name">[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createLineupTemplate(formData);
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
        Lineup Templates ({templates.length})
      </summary>
      <p className="mt-2 text-xs text-gray-500">
        A reusable named crew (e.g. &quot;Men&apos;s 1V8&quot;) you can apply to any matching race
        later, picking the physical boat at that time.
      </p>

      {templates.length > 0 && (
        <div className="mt-3 flex flex-col gap-3">
          {templates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              seats={templateSeats.filter((s) => s.template_id === t.id)}
              roster={roster}
            />
          ))}
        </div>
      )}

      <form ref={formRef} action={handleSubmit} className="mt-4 flex flex-col gap-2">
        <input name="name" placeholder="Template name (e.g. Men's 1V8)" required className="border rounded px-3 py-2 text-sm" />
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
        <select name="category" defaultValue="" className="border rounded px-3 py-2 text-sm">
          <option value="">Any category</option>
          {LINEUP_CATEGORY_OPTIONS.map((cat) => (
            <option key={cat} value={cat}>
              {LINEUP_CATEGORIES[cat]}
            </option>
          ))}
        </select>
        <input name="notes" placeholder="Notes (optional)" className="border rounded px-3 py-2 text-sm" />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={isPending}
          className="self-start bg-[#404040] text-white border-2 border-[#022e5d] rounded px-3 py-2 text-sm disabled:opacity-50"
        >
          {isPending ? "Creating..." : "Create template"}
        </button>
      </form>
    </details>
  );
}
