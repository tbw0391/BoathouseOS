"use client";

import { useRef, useState, useTransition } from "react";
import {
  createLineupTemplate,
  deleteLineupTemplate,
  assignTemplateSeat,
  updateTemplateBoat,
} from "./actions";
import { BOAT_CLASSES, BOAT_CLASS_OPTIONS } from "@/lib/boatClasses";
import { LINEUP_CATEGORIES, LINEUP_CATEGORY_GROUPS } from "@/lib/lineupCategories";
import { SeatAssign } from "./SeatAssign";
import type { Boat, LineupTemplate, LineupTemplateSeat, Profile } from "@/lib/database.types";

const SEAT_ROLE_LABEL: Record<LineupTemplateSeat["seat_role"], string> = {
  rower: "Seat",
  coxswain: "Coxswain",
  coach: "Coach",
};

function TemplateCard({
  template,
  seats,
  roster,
  boats,
}: {
  template: LineupTemplate;
  seats: LineupTemplateSeat[];
  roster: Pick<Profile, "id" | "display_name">[];
  boats: Boat[];
}) {
  const [isPending, startTransition] = useTransition();
  const [boatError, setBoatError] = useState<string | null>(null);
  const matchingBoats = boats.filter((b) => b.boat_class === template.boat_class);

  function remove() {
    if (!window.confirm(`Delete the "${template.name}" template?`)) return;
    startTransition(() => deleteLineupTemplate(template.id));
  }

  function handleBoatChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setBoatError(null);
    const boatId = e.target.value || null;
    const formData = new FormData();
    formData.set("template_id", template.id);
    if (boatId) formData.set("boat_id", boatId);
    startTransition(async () => {
      try {
        await updateTemplateBoat(formData);
      } catch (err) {
        setBoatError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
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

      <div className="mt-2 flex items-center gap-2 text-sm">
        <span className="text-gray-500">Default boat</span>
        <select
          defaultValue={template.boat_id ?? ""}
          onChange={handleBoatChange}
          disabled={isPending}
          className="border rounded px-2 py-1 text-sm disabled:opacity-50"
        >
          <option value="">— none —</option>
          {matchingBoats.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
      {boatError && <p className="text-xs text-red-600 mt-1">{boatError}</p>}

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
  boats,
}: {
  templates: LineupTemplate[];
  templateSeats: LineupTemplateSeat[];
  roster: Pick<Profile, "id" | "display_name">[];
  boats: Boat[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [boatClass, setBoatClass] = useState("");
  const [isPending, startTransition] = useTransition();

  const matchingBoats = boats.filter((b) => b.boat_class === boatClass);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createLineupTemplate(formData);
        formRef.current?.reset();
        setBoatClass("");
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
        later. Give it a default boat from the fleet, or leave it unset and pick one each time.
      </p>

      {templates.length > 0 && (
        <div className="mt-3 flex flex-col gap-3">
          {templates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              seats={templateSeats.filter((s) => s.template_id === t.id)}
              roster={roster}
              boats={boats}
            />
          ))}
        </div>
      )}

      <form ref={formRef} action={handleSubmit} className="mt-4 flex flex-col gap-2">
        <input name="name" placeholder="Template name (e.g. Men's 1V8)" required className="border rounded px-3 py-2 text-sm" />
        <select
          name="boat_class"
          value={boatClass}
          onChange={(e) => setBoatClass(e.target.value)}
          required
          className="border rounded px-3 py-2 text-sm"
        >
          <option value="" disabled>
            Boat class
          </option>
          {BOAT_CLASS_OPTIONS.map((cls) => (
            <option key={cls} value={cls}>
              {BOAT_CLASSES[cls].label}
            </option>
          ))}
        </select>
        {boatClass && (
          <select name="boat_id" defaultValue="" className="border rounded px-3 py-2 text-sm">
            <option value="">Default boat (optional — pick later instead)</option>
            {matchingBoats.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}
        <select name="category" defaultValue="" className="border rounded px-3 py-2 text-sm">
          <option value="">Any category</option>
          {LINEUP_CATEGORY_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.options.map((cat) => (
                <option key={cat} value={cat}>
                  {LINEUP_CATEGORIES[cat]}
                </option>
              ))}
            </optgroup>
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
