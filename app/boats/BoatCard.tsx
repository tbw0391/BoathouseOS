"use client";

import { useState, useTransition } from "react";
import { updateBoat, deleteBoat, assignTemplateSeat } from "@/app/lineups/actions";
import { SeatFiller } from "@/app/lineups/SeatFiller";
import { BoatTypePicker } from "./BoatTypePicker";
import { BOAT_CLASSES } from "@/lib/boatClasses";
import { LINEUP_CATEGORIES } from "@/lib/lineupCategories";
import { HULL_COLORS, RIGS } from "@/lib/boatOptions";
import type { Boat, LineupTemplateSeat } from "@/lib/database.types";
import { unwrap } from "@/lib/userError";
import Link from "next/link";
import { Wrench } from "lucide-react";
import { clearBoatMaintenance, flagBoatMaintenance } from "@/app/maintenance/actions";

export function BoatCard({
  boat,
  canManage,
  crewSeats,
  roster,
  maintenance = null,
}: {
  boat: Boat;
  canManage: boolean;
  // The boat's saved crew (every fleet boat with a squad has one), if any.
  crewSeats: LineupTemplateSeat[] | null;
  roster: { id: string; display_name: string }[];
  // Open maintenance requests for this boat (coaches/admins only).
  maintenance?: { open: number; latest: string } | null;
}) {
  const [editing, setEditing] = useState(false);
  const [flagging, setFlagging] = useState(false);
  const [whatNeeded, setWhatNeeded] = useState("");
  const [crewOpen, setCrewOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave(formData: FormData) {
    setError(null);
    if (!formData.get("boat_type")) {
      setError("Pick the boat's size (and squad, if it has one).");
      return;
    }
    formData.set("boat_id", boat.id);
    startTransition(async () => {
      try {
        unwrap(await updateBoat(formData));
        setEditing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function handleFlag() {
    setError(null);
    startTransition(async () => {
      try {
        unwrap(await flagBoatMaintenance(boat.id, whatNeeded));
        setFlagging(false);
        setWhatNeeded("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function handleFixed() {
    if (!window.confirm(`Mark ${boat.name} fixed? Its open maintenance request${maintenance && maintenance.open > 1 ? "s" : ""} will be resolved.`)) return;
    setError(null);
    startTransition(async () => {
      try {
        unwrap(await clearBoatMaintenance(boat.id));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function handleDelete() {
    if (!window.confirm(`Remove "${boat.name}" from the fleet?`)) return;
    const formData = new FormData();
    formData.set("boat_id", boat.id);
    setError(null);
    startTransition(async () => {
      try {
        unwrap(await deleteBoat(formData));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  if (editing) {
    return (
      <form
        action={handleSave}
        className="flex flex-col gap-2 rounded-lg border-2 border-[var(--color-primary)] px-3 py-3 text-sm min-w-0"
      >
        <input
          name="name"
          defaultValue={boat.name}
          required
          className="border rounded px-2 py-1 text-sm"
        />
        <BoatTypePicker boat={boat} />

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="text-xs font-medium text-white bg-[var(--color-secondary)] border-2 border-[var(--color-primary)] rounded px-2 py-1 disabled:opacity-50"
          >
            {isPending ? "Saving..." : "Save"}
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

  const typeLabel = boat.category
    ? LINEUP_CATEGORIES[boat.category]
    : BOAT_CLASSES[boat.boat_class]?.label ?? boat.boat_class;

  const tint = boat.hull_color ? HULL_COLORS[boat.hull_color]?.swatch : null;

  const filledSeats = crewSeats?.filter((s) => s.rower_id).length ?? 0;

  return (
    <div
      className={`flex flex-col items-center justify-center gap-1 rounded-lg border-2 ${
        maintenance ? "border-red-500" : "border-[var(--color-primary)]"
      } px-3 py-3 text-sm text-center min-w-0 ${crewOpen || flagging ? "col-span-3" : ""}`}
      style={tint ? { backgroundColor: `color-mix(in srgb, ${tint} 18%, white)` } : undefined}
    >
      <span className="truncate w-full font-medium">{boat.name}</span>
      <span className="text-xs text-gray-500 truncate w-full">{typeLabel}</span>
      <span className="flex items-center justify-center gap-1 text-[11px] text-gray-500">
        {boat.hull_color && (
          <>
            <span
              className="w-2.5 h-2.5 rounded-full border shrink-0"
              style={{ backgroundColor: HULL_COLORS[boat.hull_color]?.swatch }}
            />
            {HULL_COLORS[boat.hull_color]?.label}
          </>
        )}
        {boat.hull_color && boat.rig && <span>·</span>}
        {boat.rig && RIGS[boat.rig]}
      </span>
      {maintenance && (
        <Link
          href="/boat-maintenance"
          title={maintenance.latest}
          className="flex items-center gap-1 rounded-full bg-red-100 text-red-800 px-2 py-0.5 text-[11px] font-medium hover:underline max-w-full"
        >
          <Wrench className="w-3 h-3 shrink-0" aria-hidden />
          <span className="truncate">
            Needs maintenance{maintenance.open > 1 ? ` (${maintenance.open})` : ""}
          </span>
        </Link>
      )}

      {canManage && (
        <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-1">
          {crewSeats && (
            <button onClick={() => setCrewOpen(!crewOpen)} className="text-xs font-medium hover:underline">
              {crewOpen ? "Close crew" : `Crew ${filledSeats}/${crewSeats.length}`}
            </button>
          )}
          <button onClick={() => setEditing(true)} className="text-xs font-medium hover:underline">
            Edit
          </button>
          {maintenance ? (
            <button
              onClick={handleFixed}
              disabled={isPending}
              className="text-xs font-medium text-green-700 hover:underline disabled:opacity-50"
            >
              Mark fixed
            </button>
          ) : (
            <button
              onClick={() => setFlagging(!flagging)}
              className="text-xs font-medium text-red-700 hover:underline"
              aria-expanded={flagging}
            >
              {flagging ? "Cancel" : "Needs maintenance"}
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      )}
      {flagging && !maintenance && (
        <div className="w-full max-w-md mt-2 text-left flex flex-col gap-2">
          <label className="text-xs text-gray-600" htmlFor={`fix-${boat.id}`}>
            What needs to be done on {boat.name}? It goes on Boat Maintenance.
          </label>
          <textarea
            id={`fix-${boat.id}`}
            value={whatNeeded}
            onChange={(e) => setWhatNeeded(e.target.value)}
            rows={3}
            maxLength={1000}
            autoFocus
            placeholder="e.g. 3 seat rigger loose, bow ball missing"
            className="border rounded px-2 py-1 text-sm"
          />
          <button
            type="button"
            onClick={handleFlag}
            disabled={isPending || !whatNeeded.trim()}
            className="self-start text-xs font-medium text-white bg-red-600 rounded px-3 py-1.5 disabled:opacity-50"
          >
            {isPending ? "Saving..." : "Flag for maintenance"}
          </button>
        </div>
      )}
      {error && !editing && <p className="text-xs text-red-600">{error}</p>}
      {crewOpen && crewSeats && (
        <div className="w-full max-w-md mt-2 text-left">
          <p className="text-xs text-gray-500 mb-2">
            This crew fills in automatically whenever {boat.name} is put in a race.
          </p>
          <SeatFiller seats={crewSeats} roster={roster} onAssign={assignTemplateSeat} />
        </div>
      )}
    </div>
  );
}
