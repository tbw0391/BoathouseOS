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
import { SeatFiller } from "./SeatFiller";
import type { Boat, LineupTemplate, LineupTemplateSeat, Profile } from "@/lib/database.types";
import { unwrap } from "@/lib/userError";

function TemplateCard({
  template,
  seats,
  roster,
  boats,
  templates,
}: {
  template: LineupTemplate;
  seats: LineupTemplateSeat[];
  roster: Pick<Profile, "id" | "display_name">[];
  boats: Boat[];
  templates: LineupTemplate[];
}) {
  const [isPending, startTransition] = useTransition();
  const [boatError, setBoatError] = useState<string | null>(null);
  const linkedBoat = template.boat_id ? boats.find((b) => b.id === template.boat_id) ?? null : null;
  // A boat already linked to another template can't be picked here — the
  // 1:1 boat<->crew link is enforced server-side, this just avoids offering
  // a choice that would fail.
  const matchingBoats = boats.filter(
    (b) => b.boat_class === template.boat_class && !templates.some((t) => t.boat_id === b.id && t.id !== template.id)
  );

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
        unwrap(await updateTemplateBoat(formData));
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
            {linkedBoat && ` · ${linkedBoat.name}`}
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

      {/* Fleet boats with a category get this crew's boat locked in at
          creation — only a boat-less (custom) template offers a picker. */}
      {!linkedBoat && (
        <div className="mt-2 flex items-center gap-2 text-sm">
          <span className="text-gray-500">Boat</span>
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
      )}
      {boatError && <p className="text-xs text-red-600 mt-1">{boatError}</p>}

      <div className="mt-2">
        <SeatFiller seats={seats} roster={roster} onAssign={assignTemplateSeat} />
      </div>
    </div>
  );
}

export function LineupTemplatesSection({
  templates,
  templateSeats,
  rosterByTemplateId,
  boats,
}: {
  templates: LineupTemplate[];
  templateSeats: LineupTemplateSeat[];
  // Each template's seat choices, limited to its category's squad.
  rosterByTemplateId: Record<string, Pick<Profile, "id" | "display_name">[]>;
  boats: Boat[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [boatId, setBoatId] = useState("");
  const [boatClass, setBoatClass] = useState("");
  const [isPending, startTransition] = useTransition();

  // Fleet boats with a category already got their crew auto-created when
  // added — only offer boats here that don't have one yet (e.g. legacy
  // boats from before this feature).
  const boatsNeedingTemplate = boats.filter(
    (b) => b.category && !templates.some((t) => t.boat_id === b.id)
  );
  const selectedBoat = boatsNeedingTemplate.find((b) => b.id === boatId) ?? null;
  // Crews linked to a fleet boat are edited from that boat's card instead.
  const otherTemplates = templates.filter((t) => !t.boat_id || !boats.some((b) => b.id === t.boat_id));

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        unwrap(await createLineupTemplate(formData));
        formRef.current?.reset();
        setBoatId("");
        setBoatClass("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <details
      className="border rounded-lg p-4 max-w-lg"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="cursor-pointer text-sm font-medium text-gray-600">
        Other saved crews ({otherTemplates.length})
      </summary>
      <p className="mt-2 text-xs text-gray-500">
        A fleet boat&apos;s own crew is under its Crew button above. Use this for a crew that
        isn&apos;t tied to a fleet boat (like a custom development crew).
      </p>

      {otherTemplates.length > 0 && (
        <div className="mt-3 flex flex-col gap-3">
          {otherTemplates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              seats={templateSeats
                .filter((s) => s.template_id === t.id)
                .sort((a, b) =>
                  a.seat_role === b.seat_role
                    ? a.seat_number - b.seat_number
                    : a.seat_role === "coxswain"
                      ? -1
                      : b.seat_role === "coxswain"
                        ? 1
                        : 0
                )}
              roster={rosterByTemplateId[t.id] ?? []}
              boats={boats}
              templates={templates}
            />
          ))}
        </div>
      )}

      <form ref={formRef} action={handleSubmit} className="mt-4 flex flex-col gap-2">
        {boatsNeedingTemplate.length > 0 && (
          <select
            name="boat_id"
            value={boatId}
            onChange={(e) => setBoatId(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="">Custom crew (no fleet boat)</option>
            {boatsNeedingTemplate.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.category ? LINEUP_CATEGORIES[b.category] : b.boat_class})
              </option>
            ))}
          </select>
        )}

        <input
          key={boatId}
          name="name"
          placeholder="Template name (e.g. Men's 1V8)"
          defaultValue={selectedBoat?.category ? LINEUP_CATEGORIES[selectedBoat.category] : ""}
          required
          className="border rounded px-3 py-2 text-sm"
        />

        {!boatId && (
          <>
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
          </>
        )}
        <input name="notes" placeholder="Notes (optional)" className="border rounded px-3 py-2 text-sm" />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={isPending}
          className="self-start bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] rounded px-3 py-2 text-sm disabled:opacity-50"
        >
          {isPending ? "Creating..." : "Create template"}
        </button>
      </form>
    </details>
  );
}
